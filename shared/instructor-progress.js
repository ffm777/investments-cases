(() => {
'use strict';
const endpoint=(window.INVESTMENTS_LIVE_CONFIG?.endpoint||'').replace(/\/$/,'');
const labels={chapter2:['Cash-flow timeline','Value offer B','Growth & delayed payments','Recommendation'],chapter3:['Interest quotations','Yield curve','Funding','Challenge the shortcut'],chapter4:['Dividend valuation','Sensitivity','Implied growth','Two-stage model'],chapter5:['Revenue model','Free cash flows','Investment decision','Sensitivity']};
const panels=new Map();let token='',timer,busy=false;
try{token=sessionStorage.getItem('investments-instructor-key')||'';}catch{}
const connection=document.getElementById('liveConnection'),login=document.getElementById('instructorLogin'),signOut=document.getElementById('signOut');
const date=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date());
for(const [caseId,gateLabels] of Object.entries(labels)){
 const link=document.querySelector('a.case[href="'+caseId+'/"]'),wrap=document.createElement('div');wrap.className='case-wrap';link.replaceWith(wrap);wrap.append(link);link.href=caseId+'/?preview=1';link.querySelector('.open').textContent='Preview case →';
 const panel=document.createElement('section');panel.className='live-panel';panel.hidden=true;panel.setAttribute('aria-label',caseId+' live progress');
 panel.innerHTML='<div class="live-top"><h3>Class progress</h3><span class="live-count"></span></div><p class="session-note"></p><div class="gates">'+gateLabels.map((name,i)=>'<div class="gate"><label>'+String(i+1).padStart(2,'0')+' · '+name+'</label><strong>—</strong><progress max="100" value="0" aria-label="'+name+' completion"></progress><small>Not started</small></div>').join('')+'</div><p class="done-line"></p><div class="session-controls"><label>Session label <input maxlength="80" aria-label="Session label for '+caseId+'"></label><button type="button" class="start-session">Start session</button><button type="button" class="close-session" hidden>End session</button></div><p class="live-message" role="status"></p>';
 wrap.append(panel);panel.querySelector('input').value=date;
 const entry={panel,run:null};panels.set(caseId,entry);
 panel.querySelector('.start-session').addEventListener('click',()=>start(caseId));panel.querySelector('.close-session').addEventListener('click',()=>close(caseId));
}
function setStatus(text,error=false){connection.textContent=text;connection.className=error?'error':'';}
async function api(path,data){const response=await fetch(endpoint+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(8000)});const result=await response.json();if(!response.ok){const error=new Error(result.error||'Connection failed.');error.status=response.status;throw error;}return result;}
function render(caseId,run){
 const {panel}=panels.get(caseId);panels.get(caseId).run=run||null;panel.hidden=false;
 const active=run&&!run.closed_at&&run.expires_at>Date.now();
 panel.querySelector('.live-count').textContent=run?run.started+' participations started':'No session yet';
 panel.querySelector('.session-note').textContent=run?run.label+' · '+(active?'Active — direct case links join this session.':'Ended — final recorded progress.'):'Start a session before students open the case. Counts refer to browsers or groups, not verified individuals.';
 for(const [i,gate]of [...panel.querySelectorAll('.gate')].entries()){
  const count=run?.['gate'+(i+1)]||0,total=run?.started||0,percentage=total?Math.round(count/total*100):0;
  gate.querySelector('strong').textContent=total?percentage+'%':'—';gate.querySelector('progress').value=percentage;gate.querySelector('small').textContent=total?count+' of '+total+' passed':'Waiting for participants';
 }
 const total=run?.started||0,finished=run?.finished||0;
 panel.querySelector('.done-line').textContent=total?'All four gates passed: '+finished+' of '+total+' ('+Math.round(finished/total*100)+'%).':'All four gates passed: —';
 panel.querySelector('.start-session').hidden=!!active;panel.querySelector('.close-session').hidden=!active;panel.querySelector('.session-controls label').hidden=!!active;
 panel.querySelector('.start-session').textContent=run?'Start new session':'Start session';
}
async function refresh(){
 if(!token||busy)return;busy=true;
 try{const result=await api('/api/admin/overview');for(const id of panels.keys())render(id,result.runs.find(r=>r.case_id===id));login.hidden=true;signOut.hidden=false;setStatus('Live · Updated '+new Date(result.asOf).toLocaleTimeString('en-GB')+' · Refreshes every 10 seconds.');return true;}
 catch(e){if(e.status===401){logout();setStatus('Instructor access key not accepted.',true);}else setStatus('Connection interrupted — displayed counts may be out of date. Retrying automatically.',true);return false;}
 finally{busy=false;}
}
async function start(caseId){
 const entry=panels.get(caseId),panel=entry.panel,label=panel.querySelector('input').value.trim(),message=panel.querySelector('.live-message');
 if(!label){message.textContent='Enter a session label.';return;}
 const button=panel.querySelector('.start-session');button.disabled=true;message.textContent='Starting session…';
 const key='investments-pending-run-'+caseId;let id;try{id=sessionStorage.getItem(key);}catch{}if(!id){id=crypto.randomUUID();try{sessionStorage.setItem(key,id);}catch{}}
 try{await api('/api/admin/runs',{id,case:caseId,label});try{sessionStorage.removeItem(key);}catch{}message.textContent='Session started. Share the usual case URL or QR code.';await refresh();}
 catch(e){message.textContent=e.message+' Refreshing the session status…';await refresh();}
 finally{button.disabled=false;}
}
async function close(caseId){const {panel,run}=panels.get(caseId);if(!run)return;const button=panel.querySelector('.close-session');button.disabled=true;try{await api('/api/admin/runs/'+run.id+'/close',{});panel.querySelector('.live-message').textContent='Session ended. The recorded results remain visible.';await refresh();}catch(e){panel.querySelector('.live-message').textContent=e.message;}finally{button.disabled=false;}}
function logout(){clearInterval(timer);token='';try{sessionStorage.removeItem('investments-instructor-key');}catch{}for(const {panel}of panels.values())panel.hidden=true;login.hidden=false;signOut.hidden=true;setStatus('Sign in to see live class progress.');}
login.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();token=document.getElementById('instructorKey').value.trim();if(!token)return;const success=await refresh();if(success){try{sessionStorage.setItem('investments-instructor-key',token);}catch{}document.getElementById('instructorKey').value='';clearInterval(timer);timer=setInterval(refresh,10000);}});
signOut.addEventListener('click',logout);
if(!endpoint){login.hidden=true;signOut.hidden=true;setStatus('Live progress is being prepared. The cases are available as usual.');}
else if(token){void refresh();timer=setInterval(refresh,10000);}else logout();
})();

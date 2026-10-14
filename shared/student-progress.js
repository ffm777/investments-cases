(() => {
  'use strict';
  const endpoint=(window.INVESTMENTS_LIVE_CONFIG?.endpoint||'').replace(/\/$/,'');
  const api=async(path,body)=>{
    const response=await fetch(endpoint+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(6000)});
    if(!response.ok){const e=new Error('Reporting unavailable');e.status=response.status;throw e;}return response.json();
  };
  function banner(text){let el=document.getElementById('liveStatus');if(!el){el=document.createElement('p');el.id='liveStatus';el.className='note small';el.setAttribute('role','status');document.querySelector('main').prepend(el);}el.textContent=text;return el;}
  window.InvestmentsLive={async start(caseId){
    const passive={key:base=>base,passed:()=>{}};
    if(new URLSearchParams(location.search).get('preview')==='1'){banner('Instructor preview · This browser is not included in live participation counts.');return {...passive,key:base=>base+'-preview'};}
    if(!endpoint)return passive;
    let run;
    try{run=(await api('/api/cases/'+caseId+'/active')).run;}catch{banner('Live progress could not connect. Your answers remain on this device. Reload to retry before starting the class exercise.');return passive;}
    if(!run){banner('Independent practice · No teaching session is active. Your progress is not reported.');return passive;}
    const storage='investments-live-'+run.id;
    let state,canStore=true;
    try{state=JSON.parse(localStorage.getItem(storage)||'null');}catch{}
    if(!state||!/^[a-f0-9]{64}$/.test(state.token||''))state={token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),earned:[],sent:[]};
    state.earned=[...new Set([0,...(state.earned||[])])].filter(n=>Number.isInteger(n)&&n>=0&&n<=4);
    state.sent=(state.sent||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<=4);
    function persist(){try{const other=JSON.parse(localStorage.getItem(storage)||'null');if(other?.token===state.token){state.earned=[...new Set([...state.earned,...(other.earned||[])])];state.sent=[...new Set([...state.sent,...(other.sent||[])])];}localStorage.setItem(storage,JSON.stringify(state));}catch{canStore=false;}}
    let busy=false,ended=false,retry;
    const suffix=()=>canStore?'':' Browser storage is unavailable; reloading may count as another participation.';
    async function flush(){
      if(busy||ended)return;busy=true;clearTimeout(retry);retry=null;
      try{
        for(const gate of state.earned.filter(g=>!state.sent.includes(g))){
          await api('/api/events',{run:run.id,token:state.token,gate});state.sent.push(gate);persist();
        }
        banner('Class session: '+run.label+' · Your start and successfully checked gates are reported under a random session ID. Answers and written explanations stay on this device.'+suffix());
      }catch(e){
        if(e.status===409||Date.now()>=run.expires_at){ended=true;banner('This teaching session has ended. You can continue practising; further progress is not reported.');}
        else{banner('Progress reporting is temporarily offline. Continue working; pending completion updates will retry automatically.'+suffix());retry=setTimeout(flush,15000);}
      }finally{busy=false;if(!ended&&!retry&&state.earned.some(g=>!state.sent.includes(g)))retry=setTimeout(flush,0);}
    }
    persist();banner('Joining class session: '+run.label+'…');void flush();
    window.addEventListener('online',()=>void flush());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void flush();});
    return {key:base=>base+'-run-'+run.id,passed(gate){if(!Number.isInteger(gate)||gate<1||gate>4||ended)return;if(!state.earned.includes(gate)){state.earned.push(gate);persist();}void flush();}};
  }};
})();

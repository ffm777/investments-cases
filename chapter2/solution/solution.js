const $=id=>document.getElementById(id);
const STORAGE_KEY='investments-instructor-key';
const CONTEXT='investments-chapter2-instructor-solution-v1';
let slides=[],position=0,revealed=[],full=false,busy=false,payload;
function storedKey(){try{return sessionStorage.getItem(STORAGE_KEY)||'';}catch{return '';}}
function saveKey(value){try{value?sessionStorage.setItem(STORAGE_KEY,value):sessionStorage.removeItem(STORAGE_KEY);}catch{}}
function bytes(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function decrypt(password){
 if(!crypto.subtle)throw new Error('Use the HTTPS address in a current browser to unlock this page.');
 if(!payload){const response=await fetch('solution.enc.json',{cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('The solution could not be loaded. Please try again.');payload=await response.json();}
 if(payload.version!==1||payload.context!==CONTEXT||payload.iterations!==600000)throw new Error('The solution format is not supported. Reload the page.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(payload.salt),iterations:payload.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
 try{const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(payload.iv),additionalData:new TextEncoder().encode(CONTEXT),tagLength:128},key,bytes(payload.ciphertext));return new TextDecoder().decode(result);}
 catch{throw new Error('Access key not accepted. Use your instructor access key.');}
}
function maxSteps(slide){return Math.max(0,...[...slide.querySelectorAll('[data-reveal]')].map(el=>Number(el.dataset.reveal)));}
function render(){
 slides.forEach((slide,i)=>{
  slide.hidden=!full&&i!==position;
  slide.querySelectorAll('[data-reveal]').forEach(el=>{el.hidden=!full&&Number(el.dataset.reveal)>revealed[i];});
  slide.querySelectorAll('[data-until]').forEach(el=>{el.hidden=full||revealed[i]>=Number(el.dataset.until);});
 });
 $('viewSelect').value=String(position);$('previous').disabled=position===0;
 const max=maxSteps(slides[position]),step=revealed[position];
 $('stepStatus').textContent='View '+(position+1)+' of '+slides.length+' · '+step+' of '+max+' solution steps shown';
 $('next').textContent=step<max?'Reveal next step':position<slides.length-1?'Next view →':'Discussion complete';
 $('next').disabled=step===max&&position===slides.length-1;
 $('restart').disabled=step===0;
 $('handout').textContent=full?'Presentation view':'Full solution';$('handout').setAttribute('aria-pressed',String(full));
 document.body.classList.toggle('full-solution',full);
 $('content').querySelectorAll('.handout-only').forEach(el=>{el.hidden=!full;});
}
function focusTitle(){const title=slides[position].querySelector('h2');title.tabIndex=-1;title.focus({preventScroll:true});}
function go(index){position=Math.max(0,Math.min(slides.length-1,index));render();focusTitle();window.scrollTo({top:0,behavior:'instant'});}
function next(){if(!slides.length||full)return;if(revealed[position]<maxSteps(slides[position])){revealed[position]++;render();}else if(position<slides.length-1)go(position+1);}
function mount(html){
 // Only authenticated, locally decrypted course content is inserted here.
 $('content').innerHTML=html;slides=[...$('content').querySelectorAll('.slide')];
 if(slides.length!==6)throw new Error('Incomplete solution. Please reload the page.');
 position=0;revealed=slides.map(()=>0);full=false;$('viewSelect').replaceChildren();
 slides.forEach((slide,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=String(i+1).padStart(2,'0')+' · '+slide.dataset.title;$('viewSelect').append(option);});
 $('locked').hidden=true;$('solution').hidden=false;document.body.classList.add('unlocked');render();
}
async function unlock(password){
 if(busy)return;busy=true;$('unlockButton').disabled=true;$('accessStatus').className='';$('accessStatus').textContent='Unlocking…';
 try{mount(await decrypt(password));saveKey(password);$('accessKey').value='';$('accessStatus').textContent='';focusTitle();}
 catch(error){$('solution').hidden=true;$('content').replaceChildren();$('locked').hidden=false;document.body.classList.remove('unlocked');$('accessStatus').textContent=error.message;$('accessStatus').className='error';$('accessKey').focus();}
 finally{password='';busy=false;$('unlockButton').disabled=false;}
}
function lock(){
 saveKey('');$('solution').hidden=true;$('content').replaceChildren();$('viewSelect').replaceChildren();slides=[];revealed=[];position=0;full=false;
 document.body.classList.remove('unlocked','full-solution');$('locked').hidden=false;$('accessStatus').textContent='Solution locked.';$('accessKey').value='';$('accessKey').focus();
 if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
}
$('unlockForm').addEventListener('submit',event=>{event.preventDefault();const password=$('accessKey').value.trim();if(password)void unlock(password);});
$('previous').addEventListener('click',()=>go(position-1));$('next').addEventListener('click',next);
$('restart').addEventListener('click',()=>{revealed[position]=0;render();});
$('viewSelect').addEventListener('change',()=>go(Number($('viewSelect').value)));
$('handout').addEventListener('click',()=>{full=!full;render();window.scrollTo({top:0,behavior:'instant'});});
$('print').addEventListener('click',()=>window.print());$('lock').addEventListener('click',lock);
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('stepStatus').textContent='Use your browser’s full-screen command to maximise this view.';}});
document.addEventListener('keydown',event=>{
 if(!$('locked').hidden||full||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||['INPUT','SELECT','TEXTAREA','A'].includes(event.target.tagName))return;
 if(event.key===' '&&event.target.tagName!=='BUTTON'){event.preventDefault();next();}
 if(event.key==='ArrowRight'){event.preventDefault();go(position+1);}
 if(event.key==='ArrowLeft'){event.preventDefault();go(position-1);}
});
// Do not retain decrypted course content in the browser's back/forward cache.
window.addEventListener('pagehide',()=>{$('content').replaceChildren();$('solution').hidden=true;$('locked').hidden=false;document.body.classList.remove('unlocked','full-solution');});
window.addEventListener('pageshow',event=>{if(event.persisted){const key=storedKey();if(key)void unlock(key);}});
const initialKey=storedKey();if(initialKey)void unlock(initialKey);

(() => {
'use strict';
window.InvestmentsCaseFlow={create(completed){
 const stages=[1,2,3,4].map(n=>document.getElementById('phase'+n));
 const extras=[...document.querySelectorAll('section[data-case-extra]')];
 const nav=[...document.querySelectorAll('nav a[href^="#phase"]')];
 let prefix=0;
 const resume=document.createElement('p');resume.className='case-resume';resume.hidden=true;
 const text=document.createElement('span');text.textContent='Saved progress restored. ';
 const restart=document.createElement('button');restart.type='button';restart.textContent='Start a new attempt';restart.addEventListener('click',()=>document.getElementById('reset').click());resume.append(text,restart);
 stages[0].before(resume);
 const next=stages.map((stage,i)=>{
  const p=document.createElement('p');p.className='case-gate-next';p.hidden=true;
  const target=stages[i+1]||extras[0];
  if(target){if(!target.id)target.id='case-extension';const a=document.createElement('a');a.href='#'+target.id;a.textContent=i<3?'Continue to gate '+(i+2)+' →':'Continue to the optional extension →';
   a.addEventListener('click',event=>{event.preventDefault();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});const h=target.querySelector('h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}});p.append(a);
  }
  const status=document.getElementById('status'+(i+1)),anchor=status?.closest('.actions')||status||stage.querySelector('[data-check]');
  if(anchor)anchor.after(p);else stage.append(p);return p;
 });
 function sync(){
  prefix=0;while(prefix<4&&completed.has(prefix+1))prefix++;
  for(const n of [...completed])if(n>prefix){completed.delete(n);const stage=stages[n-1];if(stage){const status=document.getElementById('status'+n);if(status)status.textContent='';stage.querySelectorAll('input,select').forEach(el=>{el.removeAttribute('aria-invalid');delete el.dataset.ok;});stage.querySelectorAll('.feedback').forEach(el=>el.textContent='');}}
  stages.forEach((stage,i)=>{stage.hidden=i>prefix;next[i].hidden=!(i<prefix&&next[i].childElementCount);});
  extras.forEach(section=>section.hidden=prefix<4);
  for(const link of nav){const n=Number(link.hash.slice(6)),locked=n>prefix+1;link.setAttribute('aria-disabled',String(locked));link.classList.toggle('case-step-locked',locked);link.tabIndex=locked?-1:0;link.title=locked?'Complete the previous gate first.':'';}
  if(prefix===0)resume.hidden=true;
 }
 for(const link of nav)link.addEventListener('click',event=>{if(link.getAttribute('aria-disabled')==='true')event.preventDefault();});
 sync();
 return {sync,canCheck:p=>p<=4?p<=prefix+1:prefix===4,restore(check){
  completed.clear();sync();
  for(let p=1;p<=4;p++){
   const fields=[...stages[p-1].querySelectorAll('input,select')];
   if(!fields.length||fields.some(el=>!el.value.trim()))break;
   check(p,false);if(!completed.has(p))break;
  }
  sync();resume.hidden=prefix===0;
 }};
}};
})();

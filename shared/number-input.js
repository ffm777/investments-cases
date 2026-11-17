(() => {
'use strict';
const currency=/^(?:EUR|USD|GBP|CHF|[€$£])\s*|\s*(?:EUR|USD|GBP|CHF|[€$£])$/gi;
const invalid=()=>({value:NaN,alternative:null});
function parse(raw,{percent=false}={}){
 let s=String(raw??'').normalize('NFKC').replace(/\u2212/g,'-').replace(/[\u2009\u202f\u00a0]/g,' ').trim();
 if(!s)return invalid();
 s=s.replace(currency,'').trim();
 let sign=1;
 if(s.startsWith('(')||s.endsWith(')')){if(!/^\([^()]+\)$/.test(s))return invalid();sign=-1;s=s.slice(1,-1).trim();}
 if(/^[+-]/.test(s)){if(sign<0)return invalid();if(s[0]==='-')sign=-1;s=s.slice(1).trim();}
 else if(s.endsWith('-')){if(sign<0)return invalid();sign=-1;s=s.slice(0,-1).trim();}
 s=s.replace(currency,'').trim();
 if(s.endsWith('%')){if(!percent)return invalid();s=s.slice(0,-1).trim();}
 let factor=1;const exponential=s.match(/^(.*)[eE]([+-]?\d+)$/);
 if(exponential){s=exponential[1];factor=10**Number(exponential[2]);}
 if(!s||!Number.isFinite(factor))return invalid();
 if(/[ '’]/.test(s)){
  if(!/^[1-9]\d{0,2}(?:[ '’]\d{3})+(?:[.,]\d*)?$/.test(s))return invalid();
  s=s.replace(/[ '’]/g,'');
 }
 if(!/^[\d.,]+$/.test(s))return invalid();
 const dots=(s.match(/\./g)||[]).length,commas=(s.match(/,/g)||[]).length;
 let value,alternative=null;
 if(dots&&commas){
  const decimal=s.lastIndexOf('.')>s.lastIndexOf(',')?'.':',',group=decimal==='.'?',':'.';
  if(s.split(decimal).length!==2)return invalid();
  const [integer,fraction]=s.split(decimal);
  const escaped=group==='.'?'\\.':',';
  if(!new RegExp('^[1-9]\\d{0,2}(?:'+escaped+'\\d{3})+$').test(integer)||!/^\d*$/.test(fraction))return invalid();
  value=Number(integer.split(group).join('')+'.'+fraction);
 }else if(dots||commas){
  const sep=dots?'.':',',parts=s.split(sep);
  if(parts.length>2){
   if(!/^[1-9]\d{0,2}$/.test(parts[0])||!parts.slice(1).every(p=>/^\d{3}$/.test(p)))return invalid();
   value=Number(parts.join(''));
  }else{
   if(!/^\d*$/.test(parts[0])||!/^\d*$/.test(parts[1])||!parts.join(''))return invalid();
   const decimal=Number((parts[0]||'0')+'.'+parts[1]);
   if(/^[1-9]\d{0,2}$/.test(parts[0])&&/^\d{3}$/.test(parts[1])){
    const grouped=Number(parts.join(''));
    value=sep===','&&!percent?grouped:decimal;alternative=value===decimal?grouped:decimal;
   }else value=decimal;
  }
 }else value=Number(s);
 value=value*sign*factor;if(alternative!==null)alternative*=sign*factor;
 if(!Number.isFinite(value)||!Number.isFinite(alternative??0))return invalid();
 return {value:Object.is(value,-0)?0:value,alternative};
}
const mounted=new WeakMap();
function canonical(n){const s=String(n);return /^[+-]?\d{1,3}\.\d{3}$/.test(s)?s+'0':s;}
function read(el){
 if(typeof el==='string')el=document.getElementById(el);
 if(!el)return NaN;
 const parsed=parse(el.value,{percent:el.dataset.numberKind==='percent'});
 let info=mounted.get(el);
 if(!info){
  info=document.createElement('span');info.className='number-format';info.id='number-format-'+el.id;
  el.insertAdjacentElement('afterend',info);el.setAttribute('aria-describedby',[el.getAttribute('aria-describedby'),info.id].filter(Boolean).join(' '));mounted.set(el,info);
 }
 info.replaceChildren();
 if(Number.isFinite(parsed.value)&&el.value.trim()!==String(parsed.value)){
  const text=document.createElement('span');text.textContent='Read as '+String(parsed.value)+(el.dataset.numberKind==='percent'?'%':'')+'.';info.append(text);
 }
 if(parsed.alternative!==null){
  const button=document.createElement('button');button.type='button';button.textContent='Use '+String(parsed.alternative)+' instead';
  button.addEventListener('click',event=>{event.preventDefault();el.value=canonical(parsed.alternative);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.focus();});info.append(button);
 }
 return parsed.value;
}
function mount(){
 const inputs=[...document.querySelectorAll('input[inputmode="decimal"]')];
 for(const el of inputs){read(el);if(el.dataset.numberMounted)continue;el.dataset.numberMounted='true';el.addEventListener('input',()=>read(el));el.addEventListener('change',()=>read(el));}
 document.getElementById('reset')?.addEventListener('click',()=>queueMicrotask(()=>inputs.forEach(read)));
}
globalThis.InvestmentsNumbers={parse,read,mount};
})();

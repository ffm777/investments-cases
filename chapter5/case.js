(async()=>{
'use strict';
const live=await window.InvestmentsLive.start('chapter5');
const $=id=>document.getElementById(id),key=live.key('investments-chapter5-v1'),done=new Set();
// Fixed teaching solution, independently reconciled to the completed workbook.
const specs={
customers1:[1,'Customers in year 1','Model!E16',2200,.01,'Use population × 1%. Growth starts in year 2.'],
rides1:[1,'Rides in year 1','Model!E17',264000,.1,'Multiply year-1 customers by 120 rides per year.'],
revenue1:[1,'Total revenue in year 1 (EUR)','Model!E20',488400,1,'Include 12 monthly fees plus 120 rides with three half-hours each.'],
revenue5:[1,'Total revenue in year 5 (EUR)','Model!I20',488400*1.02**4,1,'Grow the customer base four times from year 1 to year 5. Keep prices constant.'],
tax0:[2,'Date-0 tax expense / benefit (EUR; use a minus sign for the benefit)','Model!D28',-52500,1,'The app creates negative EBIT at date 0. Multiply by 35%; enter negative tax expense.'],
fcf0:[2,'Date-0 free cash flow (EUR)','Model!D33',-342500,1,'Subtract €245,000 bicycle capex and the €150,000 app expense, then add its immediate tax saving.'],
ebit1:[2,'EBIT in year 1 (EUR)','Model!E27',247280,1,'Subtract maintenance, administration, support and €49,000 depreciation. Do not charge the app again.'],
fcf1:[2,'Free cash flow in year 1 (EUR)','Model!E33',209732,1,'Tax EBIT, then add back depreciation. No new capex occurs in year 1.'],
fcf5:[2,'Free cash flow in year 5 (EUR)','Model!I33',231232.94515712,1,'Customers and maintenance grow; administration, support and depreciation stay constant.'],
npv:[3,'Net present value (EUR)','Model!E7',534104.5235745132,1,'NPV uses years 1–5; add date-0 FCF separately. Discount at 8%.'],
npvsum:[3,'Sum of present values, including date 0 (EUR)','Model!E10',534104.5235745132,1,'Sum Model!D36:I36. Date 0 has a discount factor of 1.'],
irr:[3,'Internal rate of return (%)','Model!E8',56.29281846230745,.02,'Use all six cash flows, from date 0 through year 5. Enter percent, not the decimal fraction.'],
payback:[3,'Payback: first whole year-end (years)','Model!E9',2,.001,'Use the cumulative undiscounted cash-flow row. Here cash flows arrive at year-end; do not interpolate.'],
customerNpv:[4,'NPV with 0.8% starting customer share (EUR)','Review!F9',317978.12228067254,1,'Change Inputs!C7 only; keep 2% growth, €0.33 per ride and 8% discount rate.'],
costNpv:[4,'NPV with €0.45 maintenance per ride (EUR)','Review!F10',448791.47043220757,1,'Restore customer share to 1.0%, then change Inputs!C20 only.'],
rateNpv:[4,'NPV with 12% discount rate (EUR)','Review!F11',447542.3236301511,1,'Restore €0.33 maintenance and 1% customer share before changing the rate.'],
restoredNpv:[4,'NPV after restoring all base inputs (EUR)','Model!E7',534104.5235745132,1,'Restore 1.0% customer share, €0.33 per ride and 8% discount rate.']};
for(const[id,[p,label,ref]]of Object.entries(specs)){const el=document.createElement('label');el.className='field';el.htmlFor=id;el.innerHTML=label+'<br><span class="sheetref">'+ref+'</span><input id="'+id+'" inputmode="decimal" autocomplete="off" aria-describedby="fb-'+id+'"><span class="feedback" id="fb-'+id+'"></span>';$('fields'+p).append(el);}
function number(v){const s=v.trim().replace(/\s/g,'');return /^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s)?Number(s.replace(',','.')):NaN;}
const choice={decision:{p:3,value:'accept',hint:'Apply the NPV rule to the base-case result.'},driver:{p:4,value:'customers',hint:'Compare the three NPV reductions from the same base case.'}};
function progress(){$('bar').style.width=(done.size*25)+'%';$('progress').textContent=done.size+' of 4 gates completed';}
function save(){try{localStorage.setItem(key,JSON.stringify(Object.fromEntries([...document.querySelectorAll('input,select,textarea')].map(e=>[e.id,e.value]))));}catch{$('saveState').textContent='Browser storage unavailable. Keep the page open and export your spreadsheet regularly.';}}
function check(p,report=true){let ok=true;for(const[id,s]of Object.entries(specs)){if(s[0]!==p)continue;const n=number($(id).value),good=Number.isFinite(n)&&Math.abs(n-s[3])<=s[4];$(id).setAttribute('aria-invalid',String(!good));$(id).dataset.ok=String(good);$('fb-'+id).className='feedback '+(good?'good':'bad');$('fb-'+id).textContent=good?'Correct within rounding tolerance.':Number.isFinite(n)?s[5]:'Enter a number without thousands separators.';ok=ok&&good;}
for(const[id,s]of Object.entries(choice)){if(s.p!==p)continue;const good=$(id).value===s.value;$(id).setAttribute('aria-invalid',String(!good));$('fb-'+id).textContent=good?'Correct.':s.hint;$('fb-'+id).className='feedback '+(good?'good':'bad');ok=ok&&good;}
if(ok){done.add(p);if(report)live.passed(p);}else done.delete(p);$('status'+p).textContent=ok?'Gate complete. Discuss the short pause prompt before continuing.':'Revisit the marked entries in your spreadsheet, then check again.';progress();save();}
try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const[id,v]of Object.entries(saved))if($(id)&&typeof v==='string')$(id).value=v;}catch{}
for(let p=1;p<=4;p++){const ids=Object.keys(specs).filter(id=>specs[id][0]===p);if(ids.every(id=>$(id).value.trim())&&Object.keys(choice).filter(id=>choice[id].p===p).every(id=>$(id).value))check(p);}
document.querySelectorAll('[data-check]').forEach(b=>b.addEventListener('click',()=>check(Number(b.dataset.check))));
document.querySelectorAll('input,select,textarea').forEach(e=>e.addEventListener('input',()=>{const p=specs[e.id]?.[0]||choice[e.id]?.p;if(p){done.delete(p);$('status'+p).textContent='Changed — check this gate again.';e.removeAttribute('aria-invalid');delete e.dataset.ok;$('fb-'+e.id).textContent='';progress();}save();}));
$('print').addEventListener('click',()=>window.print());$('reset').addEventListener('click',()=>{if(!confirm('Clear page answers on this browser? Your workbook and recorded class progress are unchanged.'))return;document.querySelectorAll('input,select,textarea').forEach(e=>{e.value='';e.removeAttribute('aria-invalid');delete e.dataset.ok;});document.querySelectorAll('.feedback,[id^="status"]').forEach(e=>e.textContent='');done.clear();progress();save();});progress();
})();

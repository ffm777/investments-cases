import { steps as legacySteps, summarizeValuation } from './case.mjs?v=3';
import { stages, validateStage } from './worksheet-case.mjs?v=3';
import { mountWorkbook, sheetValues } from './workbook.mjs?v=3';
import { calculate, maxFormulaLength } from './formula.mjs?v=3';
import { migrateWorksheet } from './worksheet-migration.mjs';
import { comparisonChart } from './chart.mjs';

const workspace = document.querySelector('#workspace');
const overview = document.querySelector('#overview');
const storageKey = 'hsrm-mainwerk-arbeitsblatt-v2';
const last = stages.length;
const rowsThrough = stages.map((_, i) => stages.slice(0, i + 1).flatMap(step => step.rows));
const cellsByStage = new Map();
stages.forEach((step, i) => step.rows.forEach(row => {
  for (const column of row.editable) cellsByStage.set(column + row.row, i);
}));
let storageWorks = true;
let current = null;
let workbook = null;
let renderGeneration = 0;

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch (err) { if (!(err instanceof SyntaxError)) storageWorks = false; return null; }
}
function fresh() { return { version:3, raw:{}, choice:'', completed:0, opened:0 }; }
function computeSheet(index, raw) {
  const inputs = sheetValues(rowsThrough[index], raw);
  return calculate(inputs, Object.keys(inputs));
}
function evaluate(index, state) {
  return validateStage(index, state.raw, computeSheet(index, state.raw), state.choice);
}
function restore() {
  const stored = load(storageKey);
  const next = fresh();
  if (!stored || typeof stored !== 'object') return next;
  const raw = stored.version === 3 ? stored.raw || {} : migrateWorksheet(stored.raw || {});
  for (const [addr,value] of Object.entries(raw)) {
    if (cellsByStage.has(addr) && typeof value === 'string' && value) next.raw[addr] = value.slice(0,maxFormulaLength);
  }
  if (typeof stored.choice === 'string') next.choice = stored.choice;
  const completed = Number.isInteger(stored.completed) ? Math.min(stored.completed,last) : 0;
  while (next.completed < completed && evaluate(next.completed,next).passed) next.completed++;
  next.opened = Math.min(next.completed,last-1,Math.max(0,Number.isInteger(stored.opened)?stored.opened:0));
  return next;
}
let state = restore();
function compactRows(activeStep,endStep) {
  const hidden=new Set();
  for(let i=0;i<=endStep;i++){
    const rows=stages[i].rows;
    const optional=new Set(rows.flatMap(row=>row.optionalRows ?? []));
    for(const row of rows){
      if(!row.scratch || optional.has(row.row) || (!row.existingOnly && i>=activeStep))continue;
      const used=row.editable.some(col=>String(state.raw[col+row.row]??'').trim()!=='');
      if(!used)hidden.add(row.row);
    }
  }
  return hidden;
}
const legacy = load('hsrm-mainwerk-fallstudie-2026-v1');
function save() {
  try { localStorage.setItem(storageKey,JSON.stringify(state)); storageWorks=true; }
  catch { storageWorks=false; }
  const message = document.querySelector('#storage-warning');
  if (message) message.hidden=storageWorks;
}
function labelStart() {
  const hasEntries = Object.values(state.raw).some(Boolean) || state.choice !== '';
  for (const label of document.querySelectorAll('[data-start-label]')) {
    label.textContent = state.completed === last ? 'Ergebnisse ansehen' : state.completed || hasEntries ? 'Fallstudie fortsetzen' : 'Fallstudie starten';
  }
}
function progress() {
  const items = stages.map((step,i) => {
    const done = i < state.completed, locked = i > state.completed;
    const status = done ? ', geprüft' : locked ? ', gesperrt' : '';
    return '<li><button type="button" class="step-link'+(done?' is-complete':'')+'" data-step="'+i+'" aria-label="Schritt '+(i+1)+', '+escapeHtml(step.nav)+status+'" '+(i===current?'aria-current="step"':'')+' '+(locked?'disabled':'')+'><span class="step-number" aria-hidden="true">'+(done?'✓':i+1)+'</span><span class="step-name">'+escapeHtml(step.nav)+'</span></button></li>';
  }).join('');
  return '<nav class="study-path" aria-label="Bearbeitungsfortschritt"><div class="path-meta"><span>Ihr Bewertungsweg</span><span>'+state.completed+' von '+last+' Schritten geprüft</span></div><ol class="step-list">'+items+'</ol></nav>';
}
function exhibits(step) {
  return step.exhibits.map(item=>{
    const headings=item.headers.map(h=>'<th scope="col">'+escapeHtml(h)+'</th>').join('');
    const body=item.rows.map(row=>'<tr><th scope="row">'+escapeHtml(row[0])+'</th>'+row.slice(1).map(v=>'<td>'+escapeHtml(v)+'</td>').join('')+'</tr>').join('');
    return '<section class="exhibit"><h3>'+escapeHtml(item.title)+'</h3><div class="table-scroll" tabindex="0" role="region" aria-label="'+escapeHtml(item.title)+'"><table class="data-table"><thead><tr>'+headings+'</tr></thead><tbody>'+body+'</tbody></table></div>'+(item.note?'<p class="table-note">'+escapeHtml(item.note)+'</p>':'')+'</section>';
  }).join('');
}
function archivedInputs(i) {
  const step=legacySteps[i], draft=legacy?.drafts?.[step.id];
  if (!draft || typeof draft!=='object') return '';
  const rows=step.fields.filter(f=>typeof draft[f.id]==='string' && draft[f.id].trim()).map(f=>'<tr><th scope="row">'+escapeHtml(f.label)+'</th><td>'+escapeHtml(draft[f.id])+' '+escapeHtml(f.unit)+'</td></tr>').join('');
  const option=step.choice && /^\d+$/.test(draft.choice||'') && step.choice.options[Number(draft.choice)];
  if (!rows && !option) return '';
  return '<details class="prior-data previous-inputs"><summary>Ihre früheren Eingaben</summary><p>Diese Werte stammen aus Ihrer Bearbeitung mit einzelnen Antwortfeldern. Im neuen Arbeitsblatt können Sie den Rechenweg dazu aufbauen.</p><table class="data-table"><tbody>'+rows+'</tbody></table>'+(option?'<p>'+escapeHtml(option)+'</p>':'')+'</details>';
}
function facts(i) {
  const step=stages[i];
  const earlier=stages.slice(0,i).filter(s=>s.exhibits.length).map(s=>'<details class="prior-data"><summary>'+escapeHtml(s.nav)+'</summary>'+exhibits(s)+'</details>').join('');
  return '<aside class="case-facts" aria-label="Falldaten"><details class="current-facts" open><summary>Falldaten</summary><div>'+exhibits(step)+'</div></details>'+(earlier?'<details class="older-exhibits"><summary>Falldaten früherer Schritte</summary>'+earlier+'</details>':'')+archivedInputs(i)+'</aside>';
}
function decision(step) {
  if (!step.choice) return '';
  const opts=step.choice.options.map((option,i)=>'<label class="choice-item"><input type="radio" name="choice" data-choice value="'+i+'" '+(state.choice===String(i)?'checked':'')+'><span>'+escapeHtml(option)+'</span></label>').join('');
  return '<fieldset class="choice-group"><legend>'+escapeHtml(step.choice.question)+'</legend>'+opts+'</fieldset>';
}
function stepButtons() {
  const prev=current===0?'<button type="button" class="button-secondary" data-home>Zur Übersicht</button>':'<button type="button" class="button-secondary" data-step="'+(current-1)+'">Zurück</button>';
  const passed=current<state.completed;
  const next=current===last-1?'Zur Auswertung':'Weiter zu Schritt '+(current+2);
  return prev+(passed?'<button type="button" class="button-primary" data-step="'+(current+1)+'">'+next+'</button>':'<button type="button" class="button-primary" id="check-workbook">'+(current===0?'EBIT prüfen':'Antworten prüfen')+'</button>');
}
function guidance() {
  return '<div id="guv-hint" class="worksheet-tip" hidden><h3>Tipp zum GuV-Aufbau</h3><p>Beginnen Sie mit den Umsatzerlösen aus Absatzmenge und Stückpreis. Nach Abzug der variablen Kosten und der zahlungswirksamen Fixkosten erhalten Sie das EBITDA. Welche Aufwandsposition fehlt noch für den Übergang zum EBIT?</p><p>Prüfen Sie die Einheiten. Der Stückpreis ist in Euro angegeben, die Fixkosten und Abschreibungen in Mio. €.</p></div>';
}
function workArea(i) {
  const step=stages[i];
  return '<div class="worksheet-layout">'+facts(i)+'<section class="sheet-task" aria-labelledby="worksheet-heading"><h2 id="worksheet-heading">Ihr Bewertungsblatt</h2>'+
    '<p class="task-prompt">'+escapeHtml(step.prompt)+'</p><div id="workbook-host"></div>'+
    (i===0?guidance():'<details class="hint"><summary>Rechenhinweis anzeigen</summary><p>'+escapeHtml(step.hint)+'</p></details>')+
    decision(step)+'<div id="case-feedback" class="feedback" role="status" aria-live="polite" hidden></div><div class="action-row">'+stepButtons()+'</div></section></div>';
}
function finish() {
  const values=computeSheet(last-1, state.raw);
  const conclusion=summarizeValuation({
    dcf:values.B44.value, kgv:values.B63.value, evEbitda:values.B64.value,
    offerPremium:100*values.B70.value, terminalWeight:100*values.B71.value
  });
  return '<div class="conclusion"><p class="eyebrow">Auswertung</p><h1 class="step-title" id="step-title" tabindex="-1">'+escapeHtml(conclusion.title)+'</h1><p class="intro">'+escapeHtml(conclusion.paragraphs[0])+'</p>'+
    comparisonChart(conclusion.comparisons)+conclusion.paragraphs.slice(1).map(p=>'<p>'+escapeHtml(p)+'</p>').join('')+
    '<h2>Diskussion im Seminar</h2><ol class="discussion-list">'+conclusion.discussion.map(t=>'<li>'+escapeHtml(t)+'</li>').join('')+'</ol>'+
    '<details class="finished-sheet"><summary>Vollständiges Bewertungsblatt ansehen</summary><p class="table-note">Unter „Zurück zum Werturteil“ können Sie Ihre Berechnung weiterbearbeiten.</p><div id="final-workbook"></div></details>'+
    '<div class="action-row"><button type="button" class="button-secondary" data-step="'+(last-1)+'">Zurück zum Werturteil</button><button type="button" class="button-primary" data-home>Zur Fallübersicht</button></div>'+
    '<details class="hint reset-case"><summary>Fallstudie neu beginnen</summary><p>Der Neustart löscht die Einträge und den Fortschritt dieses Bewertungsblatts auf diesem Gerät.</p><button type="button" class="button-secondary" data-reset>Arbeitsblatt leeren und neu beginnen</button></details></div>';
}
function finishedWorkbook() {
  const detail=workspace.querySelector('.finished-sheet');
  if(!detail)return;
  detail.addEventListener('toggle',()=>{
    if(!detail.open||workbook||current!==last)return;
    const rows=rowsThrough[last-1];
    const full=sheetValues(rows,state.raw);
    const frozen=rows.map(row=>{
      const headers={...row.headers};
      for(const col of row.editable) headers[col]=full[col+row.row]??'';
      return {...row,editable:[],headers};
    });
    workbook=mountWorkbook(detail.querySelector('#final-workbook'),{
      rows:frozen,raw:{},hiddenRows:compactRows(last,last-1),viewKey:'abschluss'
    });
  });
}
function refreshNavigation() {
  const nav=workspace.querySelector('.study-path');
  if(nav)nav.outerHTML=progress();
  const bar=workspace.querySelector('.sheet-task .action-row');
  if(bar)bar.innerHTML=stepButtons();
  labelStart();
}
function setFeedback(message,status='info') {
  const box=workspace.querySelector('#case-feedback');
  if(!box)return;
  box.dataset.state=status;
  box.hidden=!message;
  box.textContent=message;
}
function showValidation(result) {
  workbook?.setMarks(result.marks);
  const hint=workspace.querySelector('#guv-hint');
  if(hint)hint.hidden=!result.showGuvHint;
  if(result.passed){setFeedback('Richtig. '+stages[current].success,'success');return;}
  const box=workspace.querySelector('#case-feedback');
  box.hidden=false;box.dataset.state='error';
  const issues=[...new Set(result.issues)];
  box.innerHTML='<strong>Prüfen Sie Ihre Eingaben.</strong><ul>'+issues.map(t=>'<li>'+escapeHtml(t)+'</li>').join('')+'</ul>';
}
function updateEntries(addresses) {
  if(current===null||current===last||!addresses.length)return;
  const owner=Math.min(...addresses.map(address=>cellsByStage.get(address)??current));
  const previousCompleted=state.completed;
  for(let i=owner;i<previousCompleted;i++){
    if(!evaluate(i,state).passed){
      state.completed=i;
      state.opened=Math.min(state.opened,i);
      break;
    }
  }
  save();
  if(state.completed<previousCompleted && (current>state.completed || visibleEnd>state.opened)){
    const destination=Math.min(current,state.completed);
    const generation=renderGeneration;
    queueMicrotask(()=>{
      if(generation!==renderGeneration)return;
      route(destination,true,addresses[0]);
      setFeedback('Ihre Änderung ist gespeichert. Prüfen Sie Schritt '+(state.completed+1)+' erneut, um die folgenden Teile wieder zu öffnen.');
    });
    return;
  }
  if(current<state.completed){
    showValidation(evaluate(current,state));
  }else{
    workbook?.setMarks({});
    setFeedback('');
  }
  if(state.completed!==previousCompleted)refreshNavigation();
  else labelStart();
}
let visibleEnd=0;
function show(index, focus=true, focusAddress) {
  const previous=workbook;
  workbook=null; previous?.destroy(); renderGeneration++;
  current=index;
  workspace.hidden=index===null;
  overview.hidden=index!==null;
  labelStart();
  if(index===null){
    workspace.replaceChildren();
    if(focus){const h=overview.querySelector('h1');h.tabIndex=-1;h.focus({preventScroll:true});window.scrollTo(0,0);}
    return;
  }
  if(index<last)state.opened=Math.max(state.opened,index);
  visibleEnd=Math.min(state.opened,state.completed,last-1);
  const step=stages[index];
  const body=index===last?finish():
    '<p class="eyebrow">Schritt '+(index+1)+' von '+last+'</p><h1 class="step-title" id="step-title" tabindex="-1">'+escapeHtml(step.title)+'</h1><p class="chapter-ref">'+escapeHtml(step.chapter)+'</p><p class="intro">'+escapeHtml(step.intro)+'</p>'+workArea(index);
  workspace.innerHTML=progress()+'<article class="study-body" aria-labelledby="step-title">'+body+'</article><p class="table-note" id="storage-warning" '+(storageWorks?'hidden':'')+'>Ihr Browser kann den Bearbeitungsstand nur bis zum Schließen dieser Seite behalten.</p>';
  if(index<last){
    const hiddenRows=compactRows(index,visibleEnd);
    const starting=step.rows.find(r=>r.editable.length && !r.existingOnly && !hiddenRows.has(r.row));
    const firstCell=starting.editable[0]+starting.row;
    workbook=mountWorkbook(workspace.querySelector('#workbook-host'),{
      rows:rowsThrough[visibleEnd], raw:state.raw, marks:{}, hiddenRows,
      onChange:({addresses})=>updateEntries(addresses), viewKey:step.id,
      focusAddress:focusAddress??firstCell, startRow:focusAddress ? undefined : step.rows[0].row
    });
    if(index<state.completed)showValidation(evaluate(index,state));
  }else finishedWorkbook();
  save();
  if(focus){workspace.querySelector('#step-title').focus({preventScroll:true});window.scrollTo(0,0);}
}
function hashFor(index){return index===null?'':index===last?'#auswertung':'#schritt-'+(index+1);}
function route(index,replace=false,focusAddress) {
  workbook?.commit();
  if(index!==null && (!Number.isInteger(index)||index<0||index>state.completed))return;
  const hash=hashFor(index);
  if(location.hash!==hash){
    const url=new URL(location.href);url.hash=hash;
    history[replace?'replaceState':'pushState'](null,'',url);
  }
  show(index,true,focusAddress);
}
function readRoute(focus=true) {
  workbook?.commit();
  const match=/^#schritt-([1-9]\d*)$/.exec(location.hash);
  let index=location.hash==='#auswertung'?last:match?Math.min(Number(match[1])-1,last-1):null;
  if(index!==null){
    index=Math.min(index,state.completed);
    if(location.hash!==hashFor(index)){
      const url=new URL(location.href);url.hash=hashFor(index);history.replaceState(null,'',url);
    }
  }
  show(index,focus);
}
workspace.addEventListener('change',e=>{
  if(!e.target.matches('[data-choice]')||current===null||!stages[current]?.choice)return;
  state.choice=e.target.value;
  if(current<state.completed)state.completed=current;
  workbook?.setMarks({});setFeedback('');refreshNavigation();save();
});
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-start],[data-home],[data-step],[data-reset],#check-workbook,.skip');
  if(!btn || btn.disabled)return;
  e.preventDefault();
  if(btn.matches('.skip')){
    const h=current===null?overview.querySelector('h1'):workspace.querySelector('#step-title');h.tabIndex=-1;h.focus();h.scrollIntoView({block:'start'});return;
  }
  if(btn.id==='check-workbook'){
    workbook?.commit();
    if(current===null || current>=last || current>state.completed)return;
    const result=evaluate(current,state);
    if(result.passed){state.completed=Math.max(state.completed,current+1);refreshNavigation();save();}
    showValidation(result);
    if(result.passed)workspace.querySelector('.action-row .button-primary')?.focus({preventScroll:true});
    return;
  }
  if(btn.hasAttribute('data-reset')){
    workbook?.destroy();workbook=null;state=fresh();save();route(0);return;
  }
  if(btn.hasAttribute('data-home'))route(null);
  else if(btn.hasAttribute('data-start'))route(state.completed);
  else route(Number(btn.dataset.step));
});
window.addEventListener('popstate',()=>readRoute());
window.addEventListener('hashchange',()=>{if(location.hash!==hashFor(current))readRoute();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)workbook?.commit();});
window.addEventListener('pagehide',()=>workbook?.commit());
readRoute(false);

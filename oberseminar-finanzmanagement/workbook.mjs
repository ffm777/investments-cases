import { calculate, translate } from './formula.mjs';

const columns = ['A', 'B', 'C', 'D'];
const directions = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
const formats = {
  auto: new Intl.NumberFormat('de-DE', {maximumFractionDigits:6, useGrouping:false}),
  number: new Intl.NumberFormat('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}),
  percent: new Intl.NumberFormat('de-DE', {style:'percent', minimumFractionDigits:2, maximumFractionDigits:2}),
  integer: new Intl.NumberFormat('de-DE', {maximumFractionDigits:0}),
};
formats.money = formats.number;
formats.multiple = formats.number;

function isWritable(row, column) {
  return row.editable?.includes(column) && !(column in (row.headers || {})) &&
    !(column === 'A' && (row.label != null || (row.section && row.title)));
}

function columnValue(row, col, raw) {
  if (Object.hasOwn(row.headers || {}, col)) return row.headers[col];
  if (col === 'A' && row.label != null) return row.label;
  if (col === 'A' && row.section && row.title) return row.title;
  return isWritable(row,col) ? (raw[col + row.row] ?? '') : '';
}

export function sheetValues(rows, raw) {
  const source = {};
  for (const row of rows) for (const col of columns) source[col + row.row] = columnValue(row, col, raw);
  return source;
}

function make(tag, parent, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  parent.append(node);
  return node;
}

export function mountWorkbook(host, {rows, raw, onChange=()=>{}, marks={}, focusAddress, startRow, viewKey}) {
  const root = document.createElement('section');
  root.className = 'case-workbook';
  root.setAttribute('aria-label','Arbeitsblatt zur Unternehmensbewertung');
  if (viewKey != null) root.dataset.view = String(viewKey);
  host.replaceChildren(root);

  const tools = make('div',root,'wb-tools');
  const toolbar = make('div',tools,'wb-toolbar');
  const fill = make('button',toolbar,'wb-fill','Nach rechts ausfüllen'); fill.type = 'button';
  const barRow = make('div',root,'wb-formula-row');
  const addressOut = make('output',barRow,'wb-address');
  addressOut.setAttribute('aria-label','Aktive Zelle'); addressOut.dataset.workbookAddress='';
  const fx = make('span',barRow,'wb-fx','ƒx'); fx.setAttribute('aria-hidden','true');
  const bar = make('input',barRow,'wb-formula');
  bar.type='text'; bar.setAttribute('aria-label','Formelleiste'); bar.autocomplete='off'; bar.spellcheck=false;
  bar.maxLength=800; bar.setAttribute('autocapitalize','off');
  const apply=make('button',barRow,'wb-apply','✓'); apply.type='button'; apply.setAttribute('aria-label','Eingabe übernehmen'); apply.title='Eingabe übernehmen';
  const scroll=make('div',root,'wb-scroll');
  const table=make('table',scroll,'wb-grid');
  table.setAttribute('aria-label','Berechnungen mit den Spalten A bis D');
  const colgroup=make('colgroup',table);
  for(const className of ['wb-gutter','wb-label-col','wb-number-col','wb-number-col','wb-number-col'])make('col',colgroup,className);
  const columnHead=table.createTHead().insertRow();
  make('td',columnHead);
  for(const col of columns) make('th',columnHead,'',col).scope='col';
  const body=table.createTBody(), buttons=new Map(), writable=new Set(), rowById=new Map(), rowNodes=new Map();
  for(const row of rows){
    const tr=body.insertRow();
    rowById.set(row.row,row); rowNodes.set(row.row,tr);
    if(row.section) tr.classList.add('wb-section');
    if(row.highlight) tr.classList.add('wb-result');
    make('th',tr,'wb-index',row.row).scope='row';
    for(const col of columns){
      const addr=col+row.row, td=tr.insertCell(), b=make('button',td,'wb-cell');
      b.type='button'; b.dataset.addr=addr; b.tabIndex=-1; buttons.set(addr,b);
      if(isWritable(row,col)){ writable.add(addr); td.classList.add('wb-writable'); }
      else td.classList.add('wb-fixed');
    }
  }
  const valid=new Set(buttons.keys());
  const readOnly=writable.size===0;
  if(readOnly) {
    fill.hidden=true;
    apply.hidden=true;
    barRow.classList.add('wb-read-only');
  }
  const ordered=[...valid], lastRow=rows.at(-1).row;
  const status=make('div',root,'wb-status');
  status.setAttribute('aria-live','polite'); status.setAttribute('aria-atomic','true');
  const help=make('details',root,'wb-help');
  help.hidden=readOnly;
  make('summary',help,'','Formeln und Bedienung');
  make('p',help,'','Wählen Sie eine Zelle und tippen Sie. Auf dem Touchscreen nutzen Sie die Formelleiste. Beginnen Sie eine Formel mit = und wählen Sie Zellbezüge per Klick oder Pfeiltaste. Enter übernimmt die Eingabe, Esc verwirft sie. Mit Tab wechseln Sie zur nächsten Zelle.');
  make('p',help,'','„Nach rechts ausfüllen“ kopiert Ihre Formel bis zur letzten Eingabespalte der Zeile. Relative Bezüge wandern mit, mit $ fixierte Bezüge bleiben stehen. Sie können auch mehrere Zellen gemeinsam aus einer Tabellenkalkulation einfügen.');
  make('p',help,'','Prozente können Sie als 5 % oder 0,05 eingeben. Rechnen Sie mit ungerundeten Zwischenwerten. Bereiche wie B2:D2 funktionieren mit SUMME, MEDIAN, MIN und MAX. Für mehrere Argumente verwenden Sie ein Semikolon.');
  const sections=rows.filter(row=>row.section);
  let jump;
  if(sections.length){
    const label=make('label',toolbar,'wb-jump-label','Bereich ');
    toolbar.insertBefore(label,fill);
    jump=make('select',label,'wb-jump');
    jump.setAttribute('aria-label','Zum Bereich im Arbeitsblatt');
    const first=document.createElement('option');first.value=String(rows[0].row);first.textContent='Blattanfang';jump.add(first);
    for(const row of sections){
      const option=document.createElement('option');
      option.value=String(row.row);option.textContent=row.title || row.label || row.headers?.A || 'Zeile '+row.row; jump.add(option);
    }
    jump.addEventListener('change',()=>{
      const target=Number(jump.value);
      rowToTop(target);
      if(editor) editor.focus({preventScroll:true});
      else select('A'+target);
    });
    scroll.addEventListener('scroll',syncJump,{passive:true});
  }
  let selected=valid.has(focusAddress)?focusAddress:ordered[0], editor=null, original='', pointed=null, caretMode=false;
  let results={}, source={}, feedback=marks, localCopy=null, destroyed=false;
  const undo=[], redo=[];

  function syncJump() {
    if(!jump)return;
    const visibleTop=scroll.getBoundingClientRect().top+table.tHead.offsetHeight+2;
    const atBottom=scroll.scrollTop>0 && scroll.clientHeight+scroll.scrollTop>=scroll.scrollHeight-1;
    const current=atBottom ? sections.at(-1) : sections.findLast(row=>rowNodes.get(row.row).getBoundingClientRect().top<=visibleTop);
    jump.value=String(current?.row ?? rows[0].row);
  }
  // Only scroll the sheet itself: readers may still be looking at the assignment above it.
  function rowToTop(rowNumber) {
    const row=rowNodes.get(rowNumber);
    if(!row)return;
    const headerHeight=table.tHead.offsetHeight;
    scroll.scrollTop += row.getBoundingClientRect().top-scroll.getBoundingClientRect().top-headerHeight;
    syncJump();
  }
  function reveal(addr){
    const rect=buttons.get(addr).getBoundingClientRect(), box=scroll.getBoundingClientRect();
    const top=box.top+table.tHead.offsetHeight;
    if(rect.top<top)scroll.scrollTop-=top-rect.top;
    else if(rect.bottom>box.bottom)scroll.scrollTop+=rect.bottom-box.bottom;
    if(rect.left<box.left)scroll.scrollLeft-=box.left-rect.left;
    else if(rect.right>box.right)scroll.scrollLeft+=rect.right-box.right;
  }
  function inputText(addr){return String(source[addr]??'');}
  function destinations(addr){
    if(addr[0]==='A'||!writable.has(addr))return [];
    return columns.slice(columns.indexOf(addr[0])+1).map(col=>col+addr.slice(1)).filter(target=>writable.has(target));
  }
  function display(addr) {
    const result=results[addr];
    if(result.error) return '#FEHLER!';
    if(result.value==null)return '';
    if(typeof result.value==='string')return result.value;
    const row=rowById.get(Number(addr.slice(1)));
    const style=row.formats?.[addr[0]] || (addr[0]!=='A' && row.format);
    if(style && formats[style]){
      const value=formats[style].format(result.value);
      return style==='multiple'?value+'×':value;
    }
    if(inputText(addr).endsWith('%'))return formats.percent.format(result.value);
    return formats.auto.format(result.value);
  }
  function marker(addr){
    const mark=feedback?.[addr];
    return typeof mark==='string'?{state:mark}:mark;
  }
  function selection(){
    if(destroyed)return;
    for(const [addr,b] of buttons){
      b.parentElement.classList.toggle('wb-active',addr===selected);
      b.parentElement.classList.toggle('wb-reference',addr===pointed?.addr);
      b.tabIndex=addr===selected?0:-1;
    }
    const canEdit=writable.has(selected);
    addressOut.textContent=selected;bar.readOnly=!canEdit;apply.disabled=!canEdit;
    bar.placeholder=canEdit?'Text, Zahl oder Formel eingeben':'Vorgabe';
    if(!editor)bar.value=inputText(selected);
    fill.disabled=!destinations(selected).length || !(editor?editor.value:inputText(selected)).trim();
    const rowLabel=results['A'+selected.slice(1)]?.value, markMessage=marker(selected)?.message;
    const statusParts=[selected,selected[0]!=='A' && typeof rowLabel==='string'?rowLabel:'',readOnly?'Leseansicht':canEdit?'Eingabezelle':'Vorgabe'];
    if(pointed)statusParts.push('Bezug '+pointed.addr);
    else if(results[selected]?.error || markMessage)statusParts.push(results[selected]?.error || markMessage);
    status.textContent=statusParts.filter(Boolean).join(' · ');
  }
  function draw(){
    if(destroyed)return;
    source=sheetValues(rows,raw);results=calculate(source,valid);
    for(const [addr,b] of buttons){
      const result=results[addr], val=display(addr), mark=marker(addr);
      b.textContent=val;
      b.parentElement.classList.toggle('wb-text',typeof result.value==='string');
      b.parentElement.classList.toggle('wb-error',!!result.error);
      if(mark?.state==='ok'||mark?.state==='bad')b.parentElement.dataset.review=mark.state;
      else delete b.parentElement.dataset.review;
      b.title=[val,result.error||mark?.message].filter(Boolean).join(' · ');
      b.setAttribute('aria-label',[addr,val||'leer',writable.has(addr)?'editierbar':'Vorgabe',
        result.error,mark?.state==='ok'?'richtig':mark?.state==='bad'?'zu prüfen':''].filter(Boolean).join(' · '));
    }
    selection();
  }
  function write(entries,remember=true){
    if(destroyed)return false;
    const changes=[];
    for(const [addr,nextValue] of entries){
      if(!writable.has(addr))continue;
      const before=String(raw[addr]??''), after=String(nextValue??'').slice(0,800);
      if(before!==after)changes.push({addr,before,after});
    }
    if(!changes.length)return false;
    if(remember){undo.push(changes);if(undo.length>50)undo.shift();redo.length=0;}
    for(const {addr,after} of changes){ if(after==='')delete raw[addr];else raw[addr]=after; }
    feedback={};draw();
    onChange({addresses:changes.map(change=>change.addr)});
    return true;
  }
  function finish(accept){
    if(!editor)return false;
    const field=editor, text=field.value.trim();editor=null;pointed=null;caretMode=false;
    if(field!==bar)field.remove();
    if(accept && text!==original && write([[selected,text]]))return true;
    selection();return false;
  }
  function select(addr,focus=false){
    if(!valid.has(addr)||destroyed)return;
    finish(true);
    if(destroyed)return;
    selected=addr;selection();
    if(focus){reveal(addr);buttons.get(addr).focus({preventScroll:true});}
  }
  function begin(kind,seed,useCursor=false){
    if(!writable.has(selected)||destroyed)return;
    if(editor && kind==='bar' && editor===bar)return;
    if(editor)finish(true);
    if(destroyed)return;
    original=inputText(selected);pointed=null;caretMode=useCursor;
    if(kind==='bar')editor=bar;
    else {
      editor=make('input',buttons.get(selected).parentElement,'wb-inline');
      editor.maxLength=800;editor.autocomplete='off';editor.spellcheck=false;
      editor.setAttribute('autocapitalize','off');editor.setAttribute('aria-label','Eingabe in '+selected);
    }
    editor.value=seed??original;bar.value=editor.value;
    editor.focus({preventScroll:true});
    if(seed!==undefined||useCursor)editor.setSelectionRange(editor.value.length,editor.value.length);
    else if(kind!=='bar')editor.select();
    selection();
  }
  function adjacent(addr,dx,dy){
    const col=columns.indexOf(addr[0]), row=Number(addr.slice(1));
    return columns[Math.max(0,Math.min(3,col+dx))]+Math.max(1,Math.min(lastRow,row+dy));
  }
  function referenceSlot(){
    if(!editor || !editor.value.trimStart().startsWith('='))return null;
    const {value,selectionStart:start,selectionEnd:end}=editor;
    if(pointed && start===end && start===pointed.end && value.slice(pointed.start,end)===pointed.token)return pointed;
    if(start!==end && start>value.indexOf('=')){
      const matched=/^(\$?)([A-D])(\$?)([1-9]\d*)$/i.exec(value.slice(start,end));
      const addr=matched && matched[2].toUpperCase()+matched[4];
      return {start,end,addr:valid.has(addr)?addr:null,lockCol:matched?.[1]||'',lockRow:matched?.[3]||''};
    }
    if(start===end && /[=+*/^(;:×·⋅−\-]\s*$/.test(value.slice(0,start))){
      const next=/^(\$?)([A-D])(\$?)([1-9]\d*)(?![A-Z0-9_])/i.exec(value.slice(start));
      return {start,end:next?end+next[0].length:end,lockCol:next?.[1]||'',lockRow:next?.[3]||''};
    }
    return null;
  }
  function point(addr,slot){
    const token=slot.lockCol+addr[0]+slot.lockRow+addr.slice(1);
    editor.setRangeText(token,slot.start,slot.end,'end');
    pointed={...slot,addr,token,end:slot.start+token.length};
    bar.value=editor.value;editor.focus({preventScroll:true});selection();
  }
  const cellAt=event=>event.target.closest('[data-addr]');
  body.addEventListener('focusin',event=>{
    const cell=cellAt(event);
    if(cell && !editor && cell.dataset.addr!==selected)select(cell.dataset.addr);
  });
  root.addEventListener('pointerdown',event=>{
    if(event.target===editor && pointed){pointed=null;selection();}
    if(cellAt(event)&&referenceSlot())event.preventDefault();
  });
  body.addEventListener('click',event=>{
    const b=cellAt(event);if(!b)return;
    const slot=referenceSlot();
    if(slot)point(b.dataset.addr,slot);else select(b.dataset.addr,true);
  });
  body.addEventListener('dblclick',event=>{
    const b=cellAt(event);
    if(!editor && b && writable.has(b.dataset.addr)){select(b.dataset.addr);begin('inline');}
  });
  bar.addEventListener('focus',()=>{if(editor!==bar)begin('bar');});
  root.addEventListener('input',event=>{
    if(event.target!==editor)return;
    pointed=null;bar.value=editor.value;selection();
  });
  root.addEventListener('focusout',event=>{
    if(event.target===editor && !event.relatedTarget?.matches('.wb-jump'))finish(true);
  });
  root.addEventListener('keydown',event=>{
    if(event.isComposing || destroyed)return;
    const b=cellAt(event);
    if(event.key==='Tab' && (b || event.target===editor)){
      const next=ordered[ordered.indexOf(selected)+(event.shiftKey?-1:1)];
      if(editor){finish(true);if(destroyed)return;select(selected,true);}
      if(next){event.preventDefault();select(next,true);}
      return;
    }
    if(editor && event.target===editor){
      if(event.key==='Enter'||event.key==='Escape'){
        event.preventDefault();finish(event.key==='Enter');if(!destroyed)select(selected,true);
      }else if(event.key==='F2'){
        event.preventDefault();caretMode=!caretMode;
        if(caretMode){pointed=null;selection();}
      }else if(directions[event.key]&&!caretMode&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey){
        const slot=referenceSlot();
        if(slot){event.preventDefault();const addr=adjacent(slot.addr||selected,...directions[event.key]);point(addr,slot);reveal(addr);}
      }
      return;
    }
    if(!b)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();const from=event.shiftKey?redo:undo, to=event.shiftKey?undo:redo;
      if(from.length){
        const change=from.pop();to.push(change);
        write(change.map(c=>[c.addr,event.shiftKey?c.after:c.before]),false);
      }
      return;
    }
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(directions[event.key]){event.preventDefault();select(adjacent(selected,...directions[event.key]),true);return;}
    if(!writable.has(selected))return;
    if(event.key==='Enter'||event.key==='F2'){event.preventDefault();begin('inline',undefined,event.key==='F2'&&inputText(selected)!=='');}
    else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();write([[selected,'']]);}
    else if(event.key.length===1){event.preventDefault();begin('inline',event.key);}
  });
  root.addEventListener('copy',event=>{
    if(editor||!cellAt(event)||!event.clipboardData)return;
    const text=inputText(selected);localCopy={addr:selected,text};
    event.clipboardData.setData('text/plain',text);
    event.clipboardData.setData('application/x-mainwerk-cell',selected);event.preventDefault();
  });
  root.addEventListener('paste',event=>{
    if(editor||!cellAt(event)||!event.clipboardData)return;
    // Also permit pasting a full TSV block over a row/column with protected
    // labels. Offsets follow the original rectangle; only writable cells change.
    const text=event.clipboardData.getData('text/plain').replace(/\r/g,'').replace(/\n$/,'');
    const sourceAddr=event.clipboardData.getData('application/x-mainwerk-cell');
    const internal=sourceAddr && localCopy?.addr===sourceAddr && text===localCopy.text;
    event.preventDefault();
    const patches=[], startCol=columns.indexOf(selected[0]), startRow=Number(selected.slice(1));
    text.split('\n').slice(0,lastRow-startRow+1).forEach((line,dy)=>{
      line.split('\t').slice(0,4-startCol).forEach((val,dx)=>{
        const addr=columns[startCol+dx]+(startRow+dy);
        patches.push([addr,internal?translate(val,startCol-columns.indexOf(sourceAddr[0]),startRow-Number(sourceAddr.slice(1))):val.trim()]);
      });
    });
    write(patches);
  });
  apply.addEventListener('click',()=>{finish(true);if(!destroyed)select(selected,true);});
  fill.addEventListener('click',()=>{
    finish(true);if(destroyed)return;
    const text=inputText(selected);if(!text.trim())return;
    const origin=columns.indexOf(selected[0]);
    write(destinations(selected).map(addr=>[addr,translate(text,columns.indexOf(addr[0])-origin,0)]));
  });
  draw();
  if(rowNodes.has(startRow))rowToTop(startRow);
  else if(focusAddress && valid.has(focusAddress))rowToTop(Number(focusAddress.slice(1)));
  return {
    commit:()=>finish(true),
    destroy(){destroyed=true;root.remove();},
    setMarks(nextMarks){feedback=nextMarks||{};draw();},
  };
}

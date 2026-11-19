import { steps, conclusion } from './case.mjs';
import { comparisonChart } from './chart.mjs';

const workspace = document.getElementById('workspace');
const overview = document.getElementById('overview');
const storageKey = 'hsrm-mainwerk-fallstudie-2026-v1';
const last = steps.length;
let storageWorks = true;
let current = null;
let state = readState();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function numberFromInput(raw, unit) {
  let value = String(raw ?? '').trim().replace(/−/g, '-');
  if (unit === '%') value = value.replace(/\s*%$/, '');
  if (unit === '€' || unit === 'Mio. €') value = value.replace(/\s*(?:Mio\.?\s*)?€$/i, '');
  if (unit === '×') value = value.replace(/\s*[×x]$/i, '');
  const groupedSpace = /^[+-]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?$/;
  if (groupedSpace.test(value)) value = value.replace(/[ \u00a0\u202f]/g, '');
  if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(value)) {
    value = value.replace(/\./g, '');
  } else if (/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(value)) {
    value = value.replace(/,/g, '');
  }
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return NaN;
  return Number(value.replace(',', '.'));
}

function fieldIsCorrect(field, draft) {
  const result = numberFromInput(draft[field.id], field.unit);
  return Number.isFinite(result) && Math.abs(result - field.expected) <= field.tolerance + 1e-9;
}

function choiceIsCorrect(step, draft) {
  return !step.choice || draft.choice === String(step.choice.correctIndex);
}

function readState() {
  let incoming;
  try {
    incoming = JSON.parse(localStorage.getItem(storageKey));
  } catch (error) {
    if (!(error instanceof SyntaxError)) storageWorks = false;
  }
  const drafts = {};
  for (const step of steps) {
    const stored = incoming?.drafts?.[step.id];
    const draft = {};
    for (const key of [...step.fields.map(field => field.id), 'choice']) {
      if (typeof stored?.[key] === 'string') draft[key] = stored[key].slice(0, 80);
    }
    drafts[step.id] = draft;
  }
  let completed = 0;
  const limit = Number.isInteger(incoming?.completed) ? Math.min(last, incoming.completed) : 0;
  while (completed < limit) {
    const step = steps[completed];
    const draft = drafts[step.id];
    if (!step.fields.every(field => fieldIsCorrect(field, draft)) || !choiceIsCorrect(step, draft)) break;
    completed++;
  }
  return { drafts, completed };
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    storageWorks = true;
  } catch {
    storageWorks = false;
  }
}

function updateStartLabels() {
  const hasDraft = Object.values(state.drafts).some(draft => Object.values(draft).some(Boolean));
  const label = state.completed === last ? 'Ergebnisse ansehen' : hasDraft ? 'Fallstudie fortsetzen' : null;
  document.querySelectorAll('[data-start-label]').forEach(el => {
    if (!el.dataset.initialLabel) el.dataset.initialLabel = el.textContent;
    el.textContent = label || el.dataset.initialLabel;
  });
}

function sidebar() {
  const items = steps.map((step, i) => {
    const done = i < state.completed;
    const locked = i > state.completed;
    const status = done ? ', bearbeitet' : locked ? ', gesperrt' : '';
    return `<li><button type="button" class="step-link${done ? ' is-complete' : ''}" data-step="${i}"
      aria-label="Schritt ${i + 1}, ${escapeHtml(step.nav)}${status}" ${i === current ? 'aria-current="step"' : ''} ${locked ? 'disabled' : ''}>
      <span class="step-number" aria-hidden="true">${done ? '✓' : String(i + 1).padStart(2, '0')}</span>
      <span class="step-name">${escapeHtml(step.nav)}</span></button></li>`;
  }).join('');
  return `<nav aria-label="Bearbeitungsfortschritt">
    <h2 class="side-heading">Ihre Bearbeitung</h2>
    <p class="progress-label" id="case-progress-label">${state.completed} von ${last} Schritten abgeschlossen</p>
    <progress class="case-progress" aria-labelledby="case-progress-label" value="${state.completed}" max="${last}"></progress>
    <ol class="step-list">${items}</ol>
    ${state.completed === last && current !== last ? '<button class="back-link" type="button" data-step="' + last + '">Auswertung ansehen</button>' : ''}
    <button class="back-link" type="button" data-home>Zur Fallübersicht</button>
  </nav>`;
}

function exhibits(step) {
  return step.exhibits.map((item, idx) => {
    const titleId = 'exhibit-' + idx;
    const headings = item.headers.map(text => '<th scope="col">' + escapeHtml(text) + '</th>').join('');
    const rows = item.rows.map(row => {
      const cells = row.slice(1).map(text => '<td>' + escapeHtml(text) + '</td>').join('');
      return '<tr><th scope="row">' + escapeHtml(row[0]) + '</th>' + cells + '</tr>';
    }).join('');
    return `<section class="exhibit" aria-labelledby="${titleId}">
      <h3 id="${titleId}">${escapeHtml(item.title)}</h3>
      <div class="table-scroll" tabindex="0" role="region" aria-labelledby="${titleId}">
      <table class="data-table" aria-labelledby="${titleId}"><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table></div>
      ${item.note ? '<p class="table-note">' + escapeHtml(item.note) + '</p>' : ''}
    </section>`;
  }).join('');
}

function answerField(field, draft) {
  const fieldId = 'answer-' + field.id;
  return `<div class="answer-field">
    <label for="${fieldId}">${escapeHtml(field.label)}</label>
    <div class="input-wrap"><input id="${fieldId}" name="${escapeHtml(field.id)}" data-answer="${escapeHtml(field.id)}"
      type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="80"
      aria-describedby="${fieldId}-unit ${fieldId}-error" value="${escapeHtml(draft[field.id] || '')}">
      <span class="unit" id="${fieldId}-unit">${escapeHtml(field.unit)}</span></div>
    <p class="field-error" id="${fieldId}-error" hidden></p>
  </div>`;
}

function choiceField(choice, draft) {
  if (!choice) return '';
  const choices = choice.options.map((text, i) => `<label class="choice-item">
    <input type="radio" name="choice" value="${i}" data-choice aria-describedby="choice-error" ${draft.choice === String(i) ? 'checked' : ''}>
    <span>${escapeHtml(text)}</span></label>`).join('');
  return `<fieldset class="choice-group"><legend>${escapeHtml(choice.question)}</legend>
    ${choices}<p class="field-error" id="choice-error" hidden></p></fieldset>`;
}

function actions() {
  const passed = current < state.completed;
  const previous = current === 0 ? '<button type="button" class="button-secondary" data-home>Zur Übersicht</button>' :
    '<button type="button" class="button-secondary" data-step="' + (current - 1) + '">Zurück</button>';
  const next = current === last - 1 ? 'Zur Auswertung' : 'Weiter zu Schritt ' + (current + 2);
  const primary = passed ? '<button class="button-primary" type="button" data-step="' + (current + 1) + '">' + next + '</button>' :
    '<button class="button-primary" type="submit">Antworten prüfen</button>';
  return previous + primary;
}

function stepContent() {
  const step = steps[current];
  const draft = state.drafts[step.id];
  const passed = current < state.completed;
  return `<p class="eyebrow">Schritt ${String(current + 1).padStart(2, '0')} von ${String(last).padStart(2, '0')}</p>
    <h1 class="step-title" id="step-title" tabindex="-1">${escapeHtml(step.title)}</h1>
    <p class="chapter-ref">${escapeHtml(step.chapter)}</p>
    <p class="intro">${escapeHtml(step.intro)}</p>
    ${exhibits(step)}
    <form class="task-form" novalidate>
      <h2>Ihre Aufgabe</h2>
      <p class="task-prompt">${escapeHtml(step.prompt)}</p>
      <p class="entry-note">Rechnen Sie mit ungerundeten Zwischenwerten. Geben Sie Ergebnisse auf zwei Nachkommastellen an. Komma und Punkt sind als Dezimalzeichen möglich.</p>
      <div class="answer-grid">${step.fields.map(field => answerField(field, draft)).join('')}</div>
      ${choiceField(step.choice, draft)}
      <details class="hint"><summary>Rechenhinweis anzeigen</summary><p>${escapeHtml(step.hint)}</p></details>
      <div class="feedback" id="case-feedback" role="status" aria-live="polite" data-state="${passed ? 'success' : ''}" ${passed ? '' : 'hidden'}>${passed ? 'Richtig. ' + escapeHtml(step.success) : ''}</div>
      <div class="action-row">${actions()}</div>
    </form>`;
}

function finalContent() {
  return `<div class="conclusion">
    <p class="eyebrow">Auswertung</p>
    <h1 class="step-title" id="step-title" tabindex="-1">${escapeHtml(conclusion.title)}</h1>
    <div class="intro"><p>${escapeHtml(conclusion.paragraphs[0])}</p></div>
    ${comparisonChart(conclusion.comparisons)}
    ${conclusion.paragraphs.slice(1).map(text => '<p>' + escapeHtml(text) + '</p>').join('')}
    <h2>Diskussion im Seminar</h2>
    <ol class="discussion-list">${conclusion.discussion.map(text => '<li>' + escapeHtml(text) + '</li>').join('')}</ol>
    <div class="action-row"><button type="button" class="button-secondary" data-step="${last - 1}">Zurück zum Werturteil</button>
      <button type="button" class="button-primary" data-home>Zur Fallübersicht</button></div>
    <details class="hint reset-case"><summary>Fallstudie neu beginnen</summary>
      <p>Beim Neustart werden die Antworten und der Fortschritt dieser Fallstudie auf diesem Gerät gelöscht.</p>
      <button class="button-secondary" type="button" data-reset>Antworten löschen und neu beginnen</button></details>
  </div>`;
}

function showPage(index, focus = true) {
  current = index;
  workspace.hidden = index === null;
  overview.hidden = index !== null;
  updateStartLabels();
  if (index === null) {
    if (focus) {
      const title = overview.querySelector('h1');
      if (title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
      }
      window.scrollTo(0, 0);
    }
    return;
  }
  workspace.innerHTML = `<div class="case-layout">
    <aside class="case-sidebar">${sidebar()}</aside>
    <article class="case-content" aria-labelledby="step-title">${index === last ? finalContent() : stepContent()}
      ${storageWorks ? '' : '<p class="table-note">Ihr Browser kann die Bearbeitung nur bis zum Schließen dieser Seite behalten.</p>'}
    </article></div>`;
  if (focus) {
    workspace.querySelector('#step-title').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function routeHash(index) {
  return index === null ? '' : index === last ? '#auswertung' : '#schritt-' + (index + 1);
}

function navigate(index) {
  if (index !== null && (!Number.isInteger(index) || index < 0 || index > state.completed)) return;
  const hash = routeHash(index);
  if (location.hash !== hash) {
    const url = new URL(location.href);
    url.hash = hash;
    history.pushState(null, '', url);
  }
  showPage(index);
}

function readRoute(focus = true) {
  const hash = location.hash;
  let requested = null;
  if (hash === '#auswertung') requested = last;
  const match = /^#schritt-([1-9]\d*)$/.exec(hash);
  if (match) requested = Number(match[1]) - 1;
  if (requested !== null && requested > state.completed) {
    requested = state.completed;
    const url = new URL(location.href);
    url.hash = routeHash(requested);
    history.replaceState(null, '', url);
  }
  showPage(requested, focus);
}

function showFieldStatus(input, errorNode, message) {
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  errorNode.textContent = message;
  errorNode.hidden = !message;
}

function onEdit(event) {
  const input = event.target;
  if (current === null || current === last || !input.matches('[data-answer], [data-choice]')) return;
  const step = steps[current];
  const isChoice = input.hasAttribute('data-choice');
  const key = isChoice ? 'choice' : input.dataset.answer;
  const draft = state.drafts[step.id];
  if (draft[key] === input.value) return;
  draft[key] = input.value;
  if (state.completed > current) {
    state.completed = current;
    workspace.querySelector('.case-sidebar').innerHTML = sidebar();
    workspace.querySelector('.action-row').innerHTML = actions();
  }
  const feedback = workspace.querySelector('#case-feedback');
  feedback.hidden = true;
  feedback.textContent = '';
  if (isChoice) {
    for (const radio of workspace.querySelectorAll('[data-choice]')) radio.removeAttribute('aria-invalid');
    workspace.querySelector('#choice-error').hidden = true;
  } else {
    showFieldStatus(input, document.getElementById(input.id + '-error'), '');
  }
  save();
}

workspace.addEventListener('input', onEdit);
workspace.addEventListener('change', onEdit);

workspace.addEventListener('submit', event => {
  event.preventDefault();
  if (current === null || current === last) return;
  if (current < state.completed) {
    navigate(current + 1);
    return;
  }
  const step = steps[current];
  const draft = state.drafts[step.id];
  const form = event.target;
  const invalid = [];
  for (const field of step.fields) {
    const input = form.elements.namedItem(field.id);
    draft[field.id] = input.value;
    let message = '';
    if (!input.value.trim()) message = 'Bitte geben Sie ein Ergebnis ein.';
    else if (!Number.isFinite(numberFromInput(input.value, field.unit))) message = 'Bitte geben Sie eine Zahl mit Dezimalkomma oder Dezimalpunkt ein.';
    else if (!fieldIsCorrect(field, draft)) message = field.hint;
    showFieldStatus(input, document.getElementById(input.id + '-error'), message);
    if (message) invalid.push(input);
  }
  if (step.choice) {
    const chosen = form.querySelector('[data-choice]:checked');
    const choice = form.querySelector('[data-choice]');
    draft.choice = chosen?.value ?? '';
    const message = chosen ? (choiceIsCorrect(step, draft) ? '' : step.choice.hint) : 'Bitte wählen Sie eine Aussage aus.';
    showFieldStatus(chosen || choice, form.querySelector('#choice-error'), message);
    if (message) invalid.push(chosen || choice);
  }
  const feedback = form.querySelector('#case-feedback');
  feedback.hidden = false;
  if (invalid.length) {
    feedback.dataset.state = 'error';
    feedback.textContent = invalid.length === 1 ? 'Eine Antwort ist noch offen. Beachten Sie den Hinweis am markierten Feld.' :
      invalid.length + ' Antworten sind noch offen. Beachten Sie die Hinweise an den markierten Feldern.';
    invalid[0].focus();
  } else {
    state.completed = current + 1;
    feedback.dataset.state = 'success';
    feedback.textContent = 'Richtig. ' + step.success;
    workspace.querySelector('.case-sidebar').innerHTML = sidebar();
    form.querySelector('.action-row').innerHTML = actions();
    form.querySelector('.button-primary').focus({ preventScroll: true });
  }
  save();
});

document.addEventListener('click', event => {
  if (event.target.closest('.skip')) {
    event.preventDefault();
    const title = current === null ? overview.querySelector('h1') : workspace.querySelector('#step-title');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus();
      title.scrollIntoView({ block: 'start' });
    }
    return;
  }
  const button = event.target.closest('[data-start], [data-home], [data-step], [data-reset]');
  if (!button || button.disabled) return;
  event.preventDefault();
  if (button.hasAttribute('data-start')) navigate(state.completed);
  else if (button.hasAttribute('data-home')) navigate(null);
  else if (button.hasAttribute('data-step')) navigate(Number(button.dataset.step));
  else {
    state = { drafts: Object.fromEntries(steps.map(step => [step.id, {}])), completed: 0 };
    save();
    navigate(0);
  }
});

window.addEventListener('popstate', () => readRoute());
window.addEventListener('hashchange', () => {
  const isCaseHash = location.hash === '#auswertung' || /^#schritt-\d+$/.test(location.hash);
  if (isCaseHash || current !== null) readRoute();
});
readRoute(false);

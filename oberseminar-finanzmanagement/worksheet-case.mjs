import { steps } from './case.mjs?v=arbeitsblatt';
import { references } from './formula.mjs';

const allColumns = ['A', 'B', 'C', 'D'];
const valueColumns = ['B', 'C', 'D'];
const [ebit, cashFlow, capital, dcf, multiples, judgment] = steps;

function section(row, title) {
  return { row, title, label: title, section: true, editable: [] };
}

function scratch(first, last) {
  return Array.from({ length: last - first + 1 }, (_, n) => ({
    row: first + n, editable: [...allColumns]
  }));
}

function result(row, label, columns = ['B'], format = 'number') {
  return { row, label, editable: [...columns], highlight: true, formats: Object.fromEntries(columns.map(col => [col,format])) };
}

function target(stage, fieldId, address, options = {}) {
  const { label, unit, expected, tolerance, hint } = stage.fields.find(field => field.id === fieldId);
  const scale = unit === '%' ? 100 : 1;
  const kind = unit === '%' ? 'percent' : unit === '×' ? 'multiple' : 'money';
  return { address, fieldId, label, kind, expected: expected / scale, tolerance: tolerance / scale, hint, ...options };
}

function customTarget(address, label, expected, hint, kind = 'money') {
  return { address, label, expected, tolerance: 0.011, kind, hint };
}

function yearly(stage, optionsForColumn) {
  return stage.fields.map((field,i) => {
    const col = valueColumns[i];
    const { address, ...options } = optionsForColumn(col);
    return target(stage, field.id, address, options);
  });
}

const salesPlan = ebit.exhibits[0];
const productionPlan = cashFlow.exhibits[0];
const capitalInputs = capital.exhibits[0];
const financing = dcf.exhibits[1];
const peers = multiples.exhibits[0];
const mainwerk = multiples.exhibits[1];
const sheetPeers = peers.rows.map(row => row.slice(1).map(v => Number(v.replaceAll('.','').replace(',','.'))));
const wacc = capital.fields.find(field => field.id === 'wacc').expected / 100;
const tv = dcf.fields.find(field => field.id === 'terminalValue').expected;
const terminalPV = tv / (1 + wacc) ** cashFlow.fields.length;
const peerKgv = valueColumns.map((_,i) => sheetPeers[0][i] / sheetPeers[2][i]);
const peerEvEbitda = valueColumns.map((_,i) => (sheetPeers[0][i] + sheetPeers[1][i]) / sheetPeers[3][i]);
const peerLabels = peers.headers.slice(1);
const peerHead = { row: 46, headers: {A:'Vergleichsunternehmen', ...Object.fromEntries(valueColumns.map((col,i) => [col,peerLabels[i]]))}, editable: [] };
const peerRows = peers.rows.map((row,i) => ({
  row: 47+i, label: row[0],
  headers: Object.fromEntries(valueColumns.map((col,j) => [col,sheetPeers[i][j]])),
  editable: []
}));
const peerTarget = (row, metric, values, hint) => valueColumns.map((col,i) =>
  customTarget(col+row, metric+' · '+peerLabels[i], values[i], hint, 'multiple'));

export const stages = [
  {
    ...ebit,
    intro: 'Erstellen Sie für die Mainwerk Pumpen AG eine Plan-GuV bis zum EBIT. Entscheiden Sie selbst, welche Positionen und Zwischensummen Sie benötigen und wie Sie diese anordnen.',
    exhibits: [{...salesPlan,
      headers:['Kennzahl',...salesPlan.headers.slice(2)],
      rows:salesPlan.rows.map(row => [row[0], ...row.slice(2)]),
      note: ebit.intro+' '+salesPlan.note
    }],
    prompt: 'Beschriften Sie Ihre Positionen in A. Nutzen Sie B für 2027, C für 2028 und D für 2029. Leiten Sie die EBIT-Werte in Zeile 12 in Mio. € mit Formeln aus Ihren beschrifteten Rechenzeilen her.',
    hint: 'Beginnen Sie mit den Umsatzerlösen aus Absatzmenge und Stückpreis. Nach Abzug der variablen Kosten und der zahlungswirksamen Fixkosten erhalten Sie das EBITDA. Welche Aufwandsposition fehlt noch für den Übergang zum EBIT? Prüfen Sie auch die Einheiten der Falldaten.',
    rows: [...scratch(1,11),result(12,'EBIT',valueColumns)],
    targets: yearly(ebit,col => ({address:col+'12', labelledGuv:true}))
  },
  {
    ...cashFlow,
    exhibits: [{...productionPlan, title:'Zusätzliche Angaben zur FCF-Planung', rows:[productionPlan.rows[3]]}],
    prompt: 'Nutzen Sie Ihre GuV aus Schritt 1. Ermitteln Sie die jährliche Veränderung des operativen NWC und leiten Sie daraus mit dem EBIT des jeweiligen Jahres den Free Cash Flow vor Finanzierung her. Nutzen Sie Zeile 22 für die drei Ergebnisse in Mio. €.',
    rows: [section(13,'Free Cash Flows'), ...scratch(14,21), result(22,'Free Cash Flow (Mio. €)',valueColumns)],
    targets: yearly(cashFlow,col => ({address:col+'22', needs:[col+'12']}))
  },
  {
    ...capital,
    exhibits: [capitalInputs],
    prompt: 'Errechnen Sie in B30 die Eigenkapitalkosten nach CAPM und in B31 die Fremdkapitalkosten vor Steuern. Ermitteln Sie in B32 den WACC bei Mainwerks Zielkapitalstruktur. Für Zinssätze können Sie das Prozentzeichen oder den entsprechenden Dezimalbruch verwenden, beispielsweise 4 % oder 0,04.',
    rows: [section(23,'Kapitalkosten'), ...scratch(24,29),
      result(30,'Eigenkapitalkosten',['B'],'percent'), result(31,'Fremdkapitalkosten vor Steuern',['B'],'percent'), result(32,'WACC',['B'],'percent')],
    targets: [target(capital,'costEquity','B30'), target(capital,'costDebt','B31'), target(capital,'wacc','B32')]
  },
  {
    ...dcf,
    exhibits: [financing],
    prompt: 'Zinsen Sie mit Ihrem WACC aus B32 die Free Cash Flows aus Zeile 22 und den Terminal Value auf den Bewertungsstichtag ab. Ermitteln Sie in B40 den Terminal Value Ende 2029, in B41 dessen Barwert und in B42 den Enterprise Value. Leiten Sie in B43 den Eigenkapitalwert und in B44 den Wert je Aktie ab.',
    hint: 'Für den Terminal Value Ende 2029 teilen Sie den erwarteten FCF 2030 durch die Differenz aus WACC und Wachstumsrate. Zinsen Sie jede Zahlung über die Zahl der Jahre bis zu ihrem Zufluss ab. Für den Terminal Value sind es drei Jahre. Verwenden Sie Zellbezüge, damit Ihre Formeln mit den ungerundeten Zwischenwerten rechnen.',
    rows: [section(33,'DCF-Bewertung'), ...scratch(34,39),
      result(40,'Terminal Value Ende 2029 (Mio. €)'),result(41,'Barwert des Terminal Value (Mio. €)'),
      result(42,'Enterprise Value (Mio. €)'),result(43,'Eigenkapitalwert (Mio. €)'),result(44,'DCF-Wert je Aktie (€)',['B'],'money')],
    targets: [
      target(dcf,'terminalValue','B40',{needs:['D22','B32']}),
      {...customTarget('B41','Barwert des Terminal Value',terminalPV,'Zinsen Sie den Wert vom 31.12.2029 über drei Jahre auf den 31.12.2026 ab.'), needs:['B32','D22']},
      target(dcf,'enterpriseValue','B42',{needs:['B22','C22','D22','B32']}),
      target(dcf,'equityValue','B43'),target(dcf,'dcfPerShare','B44')
    ]
  },
  {
    ...multiples,
    exhibits: [{...mainwerk,title:'Zusätzliche Angaben für den Vergleich',rows:[mainwerk.rows[2],mainwerk.rows[3],mainwerk.rows[4],mainwerk.rows[5]],
      note:'Die Peer-Daten in B47:D50 stehen in Mio. €. '+peers.note+' '+mainwerk.note}],
    prompt:'Berechnen Sie für jedes der drei Unternehmen in Zeile 52 das Kurs-Gewinn-Verhältnis auf Basis des erwarteten Gewinns 2027 (Forward-KGV) und in Zeile 53 den Multiplikator EV/EBITDA. Ermitteln Sie die Mediane in B61 und B62. Verwenden Sie Ihre GuV für 2027, um Mainwerks Jahresüberschuss und EBITDA zu bestimmen. Wenden Sie darauf die Mediane an und berechnen Sie in B63 und B64 die beiden Werte je Aktie.',
    rows:[section(45,'Peer-Multiplikatoren'),peerHead,...peerRows,...scratch(51,51),
      result(52,'KGV je Peer',valueColumns,'multiple'),result(53,'EV/EBITDA je Peer',valueColumns,'multiple'),
      section(54,'Bewertung von Mainwerk'),...scratch(55,60),
      result(61,'Peer-Median KGV',['B'],'multiple'),result(62,'Peer-Median EV/EBITDA',['B'],'multiple'),
      result(63,'Wert je Aktie aus KGV (€)',['B'],'money'),result(64,'Wert je Aktie aus EV/EBITDA (€)',['B'],'money')],
    targets:[
      ...peerTarget(52,'KGV',peerKgv,'Verwenden Sie den Eigenkapitalwert und den für 2027 erwarteten Jahresüberschuss desselben Peers.'),
      ...peerTarget(53,'EV/EBITDA',peerEvEbitda,'Addieren Sie die Nettofinanzschulden zum Eigenkapitalwert des Peers und teilen Sie durch sein EBITDA.'),
      target(multiples,'peerKgv','B61'),target(multiples,'peerEvEbitda','B62'),
      target(multiples,'kgvPerShare','B63',{uses2027Guv:true}),target(multiples,'evPerShare','B64',{uses2027Guv:true})
    ]
  },
  {
    ...judgment,
    exhibits:[{title:'Wertbandbreiten je Mainwerk-Aktie',headers:['Verfahren','Untergrenze je Aktie','Obergrenze je Aktie'],
      rows:judgment.exhibits[0].rows.slice(1).map(row=>[row[0],row[1]+' €',row[3]+' €']),
      note:'Die Grenzen beruhen jeweils auf dem niedrigsten und höchsten Multiplikator der drei Peers. Ihre drei Basiswerte je Aktie stehen in B44, B63 und B64.'}],
    prompt:'Berechnen Sie in B70 den prozentualen Aufschlag des Angebots gegenüber Ihrem DCF-Wert je Aktie. Ermitteln Sie in B71, welcher Anteil Ihres Enterprise Value auf den Barwert des Terminal Value entfällt. Ordnen Sie das Angebot anschließend gegenüber Ihren drei Basiswerten und den Peer-Bandbreiten ein.',
    hint:'Teilen Sie den Angebotspreis je Aktie durch den DCF-Wert je Aktie und ziehen Sie 1 ab. B70 zeigt das Ergebnis automatisch in Prozent an. Für B71 teilen Sie den Barwert des Terminal Value durch den Enterprise Value am selben Stichtag.',
    rows:[section(65,'Werturteil zum Kaufangebot'),...scratch(66,69),
      result(70,'Angebotsaufschlag gegenüber DCF',['B'],'percent'),result(71,'Anteil des Terminal Value am EV',['B'],'percent')],
    targets:[target(judgment,'premium','B70',{needs:['B44']}),target(judgment,'terminalShare','B71',{needs:['B42']})],
    choice:judgment.choice
  }
];

// Trace only actual references, including expanded SUM/median ranges. Intermediate
// rows and a student's choice of formulas may differ from the instructor calculation.
function ancestors(address, raw, valid, include = () => true) {
  const found = new Set();
  function visit(source) {
    for (const ref of references(raw[source],valid)) {
      if (found.has(ref) || !include(ref)) continue;
      found.add(ref);
      visit(ref);
    }
  }
  visit(address);
  return found;
}

export function validateStage(index, raw, computed, choice) {
  const stage = stages[index];
  const valid = new Set(Object.keys(computed));
  const errors = [], marks = {};
  for (const t of stage.targets) {
    const addr = t.address;
    const expression = String(raw[addr] ?? '').trim();
    const result = computed[addr];
    let reason, detail;
    if (!expression) {
      reason = 'empty'; detail = 'Hier fehlt noch Ihr Ergebnis.';
    } else if (result?.error) {
      reason = 'formulaError'; detail = result.error;
    } else if (typeof result?.value !== 'number' || !Number.isFinite(result.value) || Math.abs(result.value-t.expected)>t.tolerance+1e-10) {
      reason = 'value'; detail = t.hint;
      if (t.kind==='percent' && typeof result?.value==='number' && Math.abs(result.value/100-t.expected)<=t.tolerance) {
        detail = 'Verwenden Sie eine Prozentzahl mit %-Zeichen oder den entsprechenden Dezimalbruch.';
      }
    } else if (!expression.startsWith('=')) {
      reason = 'work'; detail = 'Der Zahlenwert stimmt. Leiten Sie das Ergebnis mit einer Formel im Arbeitsblatt her.';
    } else if (t.labelledGuv || t.needs || t.uses2027Guv) {
      const chain = t.labelledGuv
        ? ancestors(addr,raw,valid,ref => Number(ref.slice(1)) < 12)
        : ancestors(addr,raw,valid);
      if (t.labelledGuv && ![...chain].some(ref => ref.startsWith(addr[0]) && Number(ref.slice(1))<12 &&
          typeof computed[ref]?.value==='number' && typeof computed['A'+ref.slice(1)]?.value==='string' &&
          computed['A'+ref.slice(1)].value.trim()!=='')) {
        reason='work'; detail='Der Zahlenwert stimmt. Beziehen Sie Ihre EBIT-Formel auf eine eigene, beschriftete Zahlenzeile dieses Planjahrs.';
      }
      const missing = (t.needs ?? []).filter(ref=>!chain.has(ref));
      if (missing.length) {
        reason='work'; detail='Der Zahlenwert stimmt. Verknüpfen Sie Ihre Rechnung direkt oder über eigene Zwischenzeilen mit '+missing.join(', ')+'.';
      }
      // EBITDA can be taken directly from the student's GuV, or built from EBIT
      // plus depreciation. Both share inputs with the original EBIT model.
      if (t.uses2027Guv && !chain.has('B12')) {
        const original = ancestors('B12',raw,valid);
        const usesPlanning = [...chain].some(ref => ref.startsWith('B') && Number(ref.slice(1)) < 12 &&
          original.has(ref) && typeof computed[ref]?.value==='number');
        if (!usesPlanning) {
          reason='work'; detail='Der Zahlenwert stimmt. Verwenden Sie für den Gewinn oder das EBITDA die Positionen Ihrer GuV für 2027.';
        }
      }
    }
    marks[addr] = reason ? 'bad' : 'ok';
    if (reason) errors.push({address:addr, reason, message:addr+' · '+t.label+' – '+detail});
  }
  const choiceCorrect = !stage.choice || String(choice)===String(stage.choice.correctIndex);
  if (!choiceCorrect) {
    const unanswered = choice==null || choice==='';
    errors.push({reason:'choice',message:unanswered?'Wählen Sie eine Einschätzung für das Verkaufsgespräch.':stage.choice.hint});
  }
  const passed = errors.length===0;
  return {passed,ok:passed,marks,errors,issues:errors.map(e=>e.message),choiceCorrect,
    showGuvHint:index===0 && errors.some(e=>e.reason==='value'||e.reason==='formulaError')};
}

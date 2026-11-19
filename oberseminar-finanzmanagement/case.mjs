// All monetary amounts in the model are in millions of euros unless stated otherwise.
const years = [2027, 2028, 2029];
const assumptions = {
  pricePerPump: 20_000,
  variableCostShare: 0.60,
  tax: 0.30,
  workingCapitalShare: 0.12,
  riskFree: 0.025,
  marketPremium: 0.05,
  beta: 1.20,
  creditSpread: 0.025,
  equityWeight: 0.70,
  perpetualGrowth: 0.02,
  debt: 60,
  surplusCash: 8,
  netInterest2027: 3,
  sharesInMillions: 10,
  offerPerShare: 16.8
};
const history = { units: 5000, cashFixedCosts: 22, depreciation: 5 };
const plan = [
  { units: 5500, cashFixedCosts: 22, depreciation: 5, capex: 8 },
  { units: 5900, cashFixedCosts: 23.2, depreciation: 5.5, capex: 8.5 },
  { units: 6250, cashFixedCosts: 24, depreciation: 6, capex: 8 }
];
const peers = [
  { name: 'Isar Pumpentechnik', equity: 140, netDebt: 28, profit: 10, ebitda: 16 },
  { name: 'Weser Fluidtechnik', equity: 192, netDebt: 46, profit: 12, ebitda: 28 },
  { name: 'Lippe Fördertechnik', equity: 270, netDebt: 15, profit: 15, ebitda: 30 }
];

const revenue = period => period.units * assumptions.pricePerPump / 1_000_000;
const ebit = period => revenue(period) * (1 - assumptions.variableCostShare)
  - period.cashFixedCosts - period.depreciation;
const cashFlows = plan.map((period, i) => {
  const previous = i === 0 ? history : plan[i - 1];
  const increaseInWorkingCapital = (revenue(period) - revenue(previous)) * assumptions.workingCapitalShare;
  return ebit(period) * (1 - assumptions.tax) + period.depreciation - period.capex - increaseInWorkingCapital;
});

const equityCost = assumptions.riskFree + assumptions.beta * assumptions.marketPremium;
const debtCost = assumptions.riskFree + assumptions.creditSpread;
const wacc = assumptions.equityWeight * equityCost + (1 - assumptions.equityWeight) * debtCost * (1 - assumptions.tax);
const presentValue = (amount, yearsAhead) => amount / (1 + wacc) ** yearsAhead;
const terminalValue = growth => cashFlows.at(-1) * (1 + growth) / (wacc - growth);
const terminalPV = presentValue(terminalValue(assumptions.perpetualGrowth), years.length);
const explicitPV = cashFlows.reduce((total, flow, i) => total + presentValue(flow, i + 1), 0);
const operatingValue = explicitPV + terminalPV;
const netDebt = assumptions.debt - assumptions.surplusCash;
const equityValue = operatingValue - netDebt;
const dcfPerShare = equityValue / assumptions.sharesInMillions;
const lowerGrowth = 0.01;
const lowerGrowthPerShare = (explicitPV + presentValue(terminalValue(lowerGrowth), years.length) - netDebt) / assumptions.sharesInMillions;

const kgv = peers.map(peer => peer.equity / peer.profit).sort((a, b) => a - b);
const evEbitda = peers.map(peer => (peer.equity + peer.netDebt) / peer.ebitda).sort((a, b) => a - b);
const targetProfit = (ebit(plan[0]) - assumptions.netInterest2027) * (1 - assumptions.tax);
const targetEbitda = ebit(plan[0]) + plan[0].depreciation;
const kgvPrices = kgv.map(multiple => multiple * targetProfit / assumptions.sharesInMillions);
const evPrices = evEbitda.map(multiple => (multiple * targetEbitda - netDebt) / assumptions.sharesInMillions);
const premium = (assumptions.offerPerShare / dcfPerShare - 1) * 100;
const terminalShare = terminalPV / operatingValue * 100;

const de = (value, places = 2) => value.toLocaleString('de-DE', {
  minimumFractionDigits: places, maximumFractionDigits: places
});
const percent = fraction => de(fraction * 100) + ' %';
const euro = value => de(value) + ' €';
const table = (title, headers, rows, note) => ({ title, headers, rows, note });
const field = (id, label, unit, expected, hint) => ({ id, label, unit, expected, tolerance: 0.011, hint });
const yearRow = (label, values) => [label, ...values.map(value => de(value))];
const peerRow = (label, attribute) => [label, ...peers.map(peer => de(peer[attribute], 0))];
const periodFields = (prefix, label, values, hint) => years.map((year, i) =>
  field(prefix + year, label + ' ' + year, 'Mio. €', values[i], hint));
const stockFacts = () => table('Aktien und Finanzierung am Stichtag', ['Position', 'Betrag'], [
  ['Marktwert der verzinslichen Finanzschulden', de(assumptions.debt) + ' Mio. €'],
  ['Überschüssige Liquidität', de(assumptions.surplusCash) + ' Mio. €'],
  ['Ausstehende Stammaktien', de(assumptions.sharesInMillions, 0) + ' Mio. Stück']
], 'Alle Aktien haben dieselben Rechte. Weitere Positionen für die Überleitung zum Eigenkapital gibt es im Fall nicht.');

export const steps = [
  {
    id: 'ebit', nav: 'EBIT-Prognose', title: 'Das operative Ergebnis planen',
    chapter: 'Kapitel III · Folie 66',
    intro: 'Mainwerk fertigt Prozesspumpen für Industriekunden. Der Vertrieb erwartet steigende Stückzahlen bei einem konstanten Preis von ' + euro(assumptions.pricePerPump) + ' je Pumpe. Die bestehende Fertigung kann das zusätzliche Volumen weitgehend aufnehmen.',
    exhibits: [table('Absatz und Kosten der Fertigung', ['Kennzahl', '2026 Ist', ...years.map(String)], [
      ['Verkaufte Pumpen (Stück)', ...[history, ...plan].map(p => de(p.units, 0))],
      yearRow('Zahlungswirksame Fixkosten (Mio. €)', [history, ...plan].map(p => p.cashFixedCosts)),
      yearRow('Abschreibungen (Mio. €)', [history, ...plan].map(p => p.depreciation))
    ], 'Die variablen Kosten betragen in jedem Jahr 60 % des Umsatzes. Die Fixkosten enthalten sämtliche übrigen betrieblichen Aufwendungen außer Abschreibungen. Produktion und Absatz stimmen überein.')],
    prompt: 'Planen Sie den Umsatz aus Absatz und Stückpreis. Ziehen Sie die variablen Kosten, die Fixkosten und die Abschreibungen ab. Wie hoch ist das EBIT in jedem Planjahr?',
    fields: periodFields('ebit', 'EBIT', plan.map(ebit), 'Rechnen Sie den Umsatz in Mio. € um. Nach den variablen Kosten bleiben 40 % des Umsatzes für Fixkosten, Abschreibungen und EBIT.'),
    hint: 'Umsatz in Mio. € = Stückzahl × Preis je Pumpe ÷ 1.000.000. EBIT = Umsatz − variable Kosten − zahlungswirksame Fixkosten − Abschreibungen.',
    success: 'Der Absatz wächst schneller als die Fixkosten. Dadurch steigt die EBIT-Marge über den Planungszeitraum.'
  },
  {
    id: 'fcf', nav: 'Free Cash Flows', title: 'Den Free Cash Flow ermitteln',
    chapter: 'Kapitel III · Folien 65 und 67–68a',
    intro: 'Mainwerk investiert in Prüfstände und Montageplätze. Mit dem Umsatz wachsen auch Vorräte und Kundenforderungen. Wie viel Geld steht nach Steuern und Investitionen für die Eigen- und Fremdkapitalgeber zur Verfügung?',
    exhibits: [table('Operative Planung in Mio. €', ['Kennzahl', ...years.map(String)], [
      yearRow('Umsatz', plan.map(revenue)),
      yearRow('EBIT', plan.map(ebit)),
      yearRow('Abschreibungen', plan.map(p => p.depreciation)),
      yearRow('Auszahlungen für Sachinvestitionen', plan.map(p => p.capex))
    ], 'Der Umsatz 2026 lag bei ' + de(revenue(history), 0) + ' Mio. €. Das operative Net Working Capital beträgt an jedem Jahresende einschließlich 2026 genau 12 % des Jahresumsatzes. Der Ertragsteuersatz liegt bei 30 %. Weitere zahlungsunwirksame Posten gibt es nicht.')],
    prompt: 'Berechnen Sie zuerst die jährliche Veränderung des operativen Net Working Capital. Leiten Sie anschließend die drei Free Cash Flows vor Finanzierung aus dem EBIT ab.',
    fields: periodFields('fcf', 'Free Cash Flow', cashFlows, 'Ziehen Sie die Zunahme des operativen NWC gegenüber dem Vorjahr ab. Addieren Sie die Abschreibungen und ziehen Sie die Sachinvestitionen ab.'),
    hint: 'NOPLAT = EBIT × (1 − Steuersatz). FCF = NOPLAT + Abschreibungen − Sachinvestitionen − Zunahme des operativen NWC. Für 2027 ist der NWC-Bestand vom 31.12.2026 der Ausgangspunkt.',
    success: 'Der Ausbau bindet in allen drei Jahren zusätzliche Mittel. Der Free Cash Flow bleibt deshalb unter dem operativen Ergebnis nach Steuern.'
  },
  {
    id: 'wacc', nav: 'Kapitalkosten', title: 'Die Kapitalkosten bestimmen',
    chapter: 'Kapitel III · Folien 70, 79 und 83–86',
    intro: 'Die Eigentümer möchten wissen, welche Rendite die Kapitalgeber für das Risiko des Geschäfts verlangen. Mainwerk plant dauerhaft mit 70 % Eigenkapital und 30 % verzinslichem Fremdkapital, jeweils zu Marktwerten.',
    exhibits: [table('Annahmen am 31.12.2026', ['Größe', 'Wert'], [
      ['Risikoloser Jahreszins', percent(assumptions.riskFree)],
      ['Marktrisikoprämie', percent(assumptions.marketPremium)],
      ['Verschuldetes Eigenkapital-Beta bei Zielkapitalstruktur', de(assumptions.beta)],
      ['Kreditaufschlag auf den risikolosen Zins', de(assumptions.creditSpread * 100) + ' Prozentpunkte'],
      ['Ertragsteuersatz', percent(assumptions.tax)]
    ])],
    prompt: 'Bestimmen Sie die Eigenkapitalkosten nach dem CAPM und die Fremdkapitalkosten vor Steuern. Berechnen Sie daraus den WACC unter Berücksichtigung des steuerlichen Zinsvorteils.',
    fields: [
      field('costEquity', 'Eigenkapitalkosten', '%', equityCost * 100, 'Multiplizieren Sie die Marktrisikoprämie mit dem Eigenkapital-Beta und addieren Sie den risikolosen Zins.'),
      field('costDebt', 'Fremdkapitalkosten vor Steuern', '%', debtCost * 100, 'Addieren Sie zum risikolosen Zins den Kreditaufschlag.'),
      field('wacc', 'WACC', '%', wacc * 100, 'Gewichten Sie die Eigenkapitalkosten mit 70 % und die Fremdkapitalkosten nach Steuern mit 30 %.')
    ],
    hint: 'Eigenkapitalkosten = risikoloser Zins + Beta × Marktrisikoprämie. Fremdkapitalkosten = risikoloser Zins + Kreditaufschlag. Im WACC mindert der Faktor (1 − Steuersatz) die Fremdkapitalkosten.',
    success: 'Der WACC enthält den Steuervorteil der Fremdfinanzierung. Mit diesem Satz können Sie die Free Cash Flows vor Finanzierung abzinsen.'
  },
  {
    id: 'dcf', nav: 'DCF-Bewertung', title: 'Vom Free Cash Flow zum Aktienwert',
    chapter: 'Kapitel III · Folien 59 und 89–90b',
    intro: 'Der Bewertungsstichtag ist der 31.12.2026. Alle Free Cash Flows fließen am jeweiligen Jahresende. Ab 2030 wächst der Free Cash Flow ausgehend vom Wert für 2029 dauerhaft um 2 % pro Jahr.',
    exhibits: [
      table('Zahlungen der Detailplanungsphase', ['Mio. €', ...years.map(String)], [yearRow('Free Cash Flow', cashFlows)], 'Der WACC beträgt in beiden Phasen ' + percent(wacc) + '.'),
      stockFacts()
    ],
    prompt: 'Berechnen Sie den Terminal Value zum 31.12.2029. Zinsen Sie ihn und die drei einzelnen Free Cash Flows auf den Stichtag ab. Leiten Sie aus dem operativen Unternehmenswert den Eigenkapitalwert und den Wert je Aktie ab.',
    fields: [
      field('terminalValue', 'Terminal Value Ende 2029', 'Mio. €', terminalValue(assumptions.perpetualGrowth), 'Verwenden Sie den FCF 2030 im Zähler und WACC minus Wachstumsrate im Nenner.'),
      field('enterpriseValue', 'Enterprise Value zum Stichtag', 'Mio. €', operatingValue, 'Addieren Sie die Barwerte der drei Free Cash Flows und den über drei Jahre abgezinsten Terminal Value.'),
      field('equityValue', 'Eigenkapitalwert zum Stichtag', 'Mio. €', equityValue, 'Ziehen Sie vom Enterprise Value die verzinslichen Finanzschulden ab und addieren Sie die überschüssige Liquidität.'),
      field('dcfPerShare', 'DCF-Wert je Aktie', '€', dcfPerShare, 'Teilen Sie den Eigenkapitalwert in Mio. € durch die in Millionen angegebene Aktienanzahl.')
    ],
    hint: 'Terminal Value Ende 2029 = FCF 2030 ÷ (WACC − g). Jeder Barwert ergibt sich aus dem jeweiligen Betrag geteilt durch (1 + WACC) hoch Anzahl der Jahre bis zur Zahlung. Der Terminal Value liegt drei Jahre nach dem Stichtag. Rechnen Sie mit ungerundeten Zwischenwerten und runden Sie erst Ihre Eingaben auf zwei Nachkommastellen.',
    success: 'Für jede Aktie entfällt derselbe Anteil am Eigenkapital. Diesen DCF-Wert können Sie jetzt mit den Preisen vergleichbarer Unternehmen abgleichen.'
  },
  {
    id: 'multiples', nav: 'Multiplikatoren', title: 'Die Bewertung am Markt spiegeln',
    chapter: 'Kapitel IV · Folien 101–103 und 106–109b',
    intro: 'Drei börsennotierte Hersteller von Industriepumpen beliefern ähnliche Kunden. Verwenden Sie ihre Börsenwerte am 31.12.2026 und die für 2027 erwarteten, um Sondereffekte bereinigten Gewinne und EBITDA.',
    exhibits: [
      table('Vergleichsunternehmen in Mio. €', ['Kennzahl', ...peers.map(p => p.name)], [
        peerRow('Marktwert Eigenkapital', 'equity'), peerRow('Nettofinanzschulden', 'netDebt'),
        peerRow('Jahresüberschuss 2027', 'profit'), peerRow('EBITDA 2027', 'ebitda')
      ], 'Nettofinanzschulden = Finanzschulden abzüglich überschüssiger Liquidität. Weitere Überleitungspositionen gibt es bei keinem der Unternehmen.'),
      table('Mainwerk als Bewertungsobjekt', ['Kennzahl', 'Wert'], [
        ['EBIT 2027', de(ebit(plan[0])) + ' Mio. €'],
        ['Abschreibungen 2027', de(plan[0].depreciation) + ' Mio. €'],
        ['Nettozinsaufwand 2027', de(assumptions.netInterest2027) + ' Mio. €'],
        ['Ertragsteuersatz', percent(assumptions.tax)],
        ['Nettofinanzschulden am Stichtag', de(netDebt) + ' Mio. €'],
        ['Ausstehende Aktien', de(assumptions.sharesInMillions, 0) + ' Mio. Stück']
      ], 'Der Jahresüberschuss 2027 ergibt sich aus dem EBIT abzüglich Nettozinsaufwand und Steuern auf das Ergebnis vor Steuern.')
    ],
    prompt: 'Berechnen Sie für jedes Vergleichsunternehmen das Forward-KGV und EV/EBITDA. Bestimmen Sie für jede Reihe den Median. Wenden Sie beide Mediane auf Mainwerk an und geben Sie die resultierenden Werte je Aktie an.',
    fields: [
      field('peerKgv', 'Median des KGV', '×', kgv[1], 'Teilen Sie den Eigenkapitalwert jedes Peers durch seinen Jahresüberschuss. Sortieren Sie die drei Ergebnisse. Der mittlere Wert ist der Median.'),
      field('peerEvEbitda', 'Median von EV/EBITDA', '×', evEbitda[1], 'Addieren Sie je Peer zum Eigenkapitalwert die Nettofinanzschulden und teilen Sie diese Summe durch das EBITDA.'),
      field('kgvPerShare', 'Wert je Aktie aus KGV', '€', kgvPrices[1], 'Multiplizieren Sie den Median des KGV mit dem Jahresüberschuss von Mainwerk und teilen Sie durch die Zahl der Aktien.'),
      field('evPerShare', 'Wert je Aktie aus EV/EBITDA', '€', evPrices[1], 'Multiplizieren Sie den Median von EV/EBITDA mit dem EBITDA von Mainwerk. Ziehen Sie die Nettofinanzschulden ab und teilen Sie durch die Aktienanzahl.')
    ],
    hint: 'KGV = Marktwert des Eigenkapitals ÷ Jahresüberschuss. EV/EBITDA = (Marktwert des Eigenkapitals + Nettofinanzschulden) ÷ EBITDA. Für Mainwerk gilt EBITDA = EBIT + Abschreibungen.',
    success: 'Das KGV führt unmittelbar zum Eigenkapitalwert. Beim EV/EBITDA ergibt sich der Eigenkapitalwert erst nach Abzug der Nettofinanzschulden.'
  },
  {
    id: 'urteil', nav: 'Werturteil', title: 'Das Kaufangebot einordnen',
    chapter: 'Kapitel III · Folie 89 und Kapitel IV · Folien 106–109b',
    intro: 'Ein Interessent bietet unverbindlich ' + euro(assumptions.offerPerShare) + ' je Stammaktie. Eine Kontrollprämie und Käufersynergien bleiben in der Fallrechnung außer Ansatz. Die Eigentümer bitten Sie um eine Einschätzung für das Verkaufsgespräch.',
    exhibits: [
      table('Werte je Mainwerk-Aktie in €', ['Verfahren', 'Minimum¹', 'Basiswert', 'Maximum¹'], [
        ['DCF', '–', de(dcfPerShare), '–'],
        ['KGV', ...kgvPrices.map(v => de(v))],
        ['EV/EBITDA', ...evPrices.map(v => de(v))]
      ], '¹ Die Bandbreiten ergeben sich aus dem niedrigsten und höchsten Multiplikator der drei Peers. Der Basiswert der Multiplikatorverfahren beruht jeweils auf dem Median.'),
      table('Barwerte im DCF-Modell', ['Position zum 31.12.2026', 'Mio. €'], [
        ['Barwert der drei einzelnen Free Cash Flows', de(explicitPV)],
        ['Barwert des Terminal Value', de(terminalPV)],
        ['Enterprise Value', de(operatingValue)]
      ])
    ],
    prompt: 'Wie viel Prozent liegt das Angebot über dem DCF-Wert je Aktie? Welcher Anteil des Enterprise Value entfällt auf den abgezinsten Terminal Value?',
    fields: [
      field('premium', 'Aufschlag gegenüber dem DCF-Wert', '%', premium, 'Teilen Sie die Differenz zwischen Angebot und DCF-Wert je Aktie durch den DCF-Wert je Aktie.'),
      field('terminalShare', 'Anteil des Terminal Value am Enterprise Value', '%', terminalShare, 'Teilen Sie den Barwert des Terminal Value durch den Enterprise Value am selben Stichtag.')
    ],
    choice: {
      question: 'Welche Aussage würden Sie den Eigentümern für das Verkaufsgespräch mitgeben?',
      options: [
        'Das Angebot liegt über den drei Basiswerten und übersteigt damit auch die Obergrenzen beider aus den Peers abgeleiteten Wertbandbreiten.',
        'Das Angebot übersteigt alle drei Basiswerte und liegt in beiden Peer-Bandbreiten. Für seine Einordnung lohnt sich ein genauer Blick auf das langfristige FCF-Wachstum.',
        'Das Angebot liegt in beiden Peer-Bandbreiten. Damit ist die im DCF-Modell gewählte langfristige Wachstumsrate von 2 % durch die Börsenkurse bestätigt.'
      ],
      correctIndex: 1,
      hint: 'Vergleichen Sie das Angebot mit den Medianwerten und den beiden Obergrenzen. Überlegen Sie, welche DCF-Annahme den größten Wertbestandteil prägt.'
    },
    hint: 'Aufschlag in % = (Angebot je Aktie ÷ DCF-Wert je Aktie − 1) × 100. Für den Anteil des Terminal Value vergleichen Sie zwei auf denselben Stichtag abgezinste Größen.',
    success: 'Sie haben den Angebotspreis mit dem DCF-Wert und mit beiden Peer-Bandbreiten verglichen.'
  }
];

export const conclusion = {
  title: 'Was bedeutet das Angebot für die Eigentümer?',
  paragraphs: [
    'Das Angebot von ' + euro(assumptions.offerPerShare) + ' je Aktie liegt ' + de(premium) + ' % über dem DCF-Wert von ' + euro(dcfPerShare) + '. Auch die Peer-Mediane von ' + euro(kgvPrices[1]) + ' (KGV) und ' + euro(evPrices[1]) + ' (EV/EBITDA) liegen darunter. Gemessen an den Basiswerten ist der Preis für die Verkäufer attraktiv. Beide Peer-Bandbreiten lassen auch höhere Werte zu.',
    'Rund ' + de(terminalShare, 1) + ' % des operativen Unternehmenswerts stammen aus den Jahren nach 2029. Wächst der Free Cash Flow ab 2030 nur um ' + percent(lowerGrowth) + ' statt um ' + percent(assumptions.perpetualGrowth) + ', sinkt der DCF-Wert bei gleichem WACC auf ' + euro(lowerGrowthPerShare) + ' je Aktie.'
  ],
  comparisons: [
    { label: 'DCF', value: dcfPerShare },
    { label: 'KGV', value: kgvPrices[1], low: kgvPrices[0], high: kgvPrices[2] },
    { label: 'EV/EBITDA', value: evPrices[1], low: evPrices[0], high: evPrices[2] },
    { label: 'Kaufangebot', value: assumptions.offerPerShare }
  ],
  discussion: [
    'Welche Nachweise würden Sie vom Vertrieb und von der Produktion anfordern, um das langfristige Wachstum und den dafür nötigen Investitionsbedarf zu beurteilen?',
    'Ein Vergleichsunternehmen muss seine Fertigung aufwendiger erneuern als Mainwerk. Wie beeinflusst das die Aussagekraft von EV/EBITDA?',
    'Würden Sie den Eigentümern empfehlen, das Angebot anzunehmen oder weiterzuverhandeln? Begründen Sie Ihre Position mit dem DCF-Wert, der Peer-Bandbreite und einer Annahme, die Sie noch prüfen möchten.'
  ]
};

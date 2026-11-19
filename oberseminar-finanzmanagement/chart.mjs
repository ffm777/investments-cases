// Range plot with a shared euro-per-share scale for each valuation method.
const format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const escapeLabel = label => label.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function comparisonChart(comparisons) {
  const minimum = Math.min(...comparisons.map(item => item.low ?? item.value));
  const maximum = Math.max(...comparisons.map(item => item.high ?? item.value));
  const tickSize = Math.max(1, Math.ceil((maximum - minimum) / 4));
  const start = Math.floor(minimum / tickSize) * tickSize;
  const end = Math.ceil(maximum / tickSize) * tickSize;
  const percent = value => 100 * (value - start) / (end - start);
  const tickCount = (end - start) / tickSize;
  const ticks = Array.from({length: tickCount + 1}, (_, index) => '<span>' + (start + index * tickSize) + '</span>').join('');
  const rows = comparisons.map(({label, value, low, high}) => {
    const range = Number.isFinite(low) && Number.isFinite(high);
    const interval = range ? '<i class="plot-range" style="--lo:' + percent(low) + '%;--span:' + (percent(high) - percent(low)) + '%"></i>' : '';
    const labelText = escapeLabel(label);
    const description = range ? 'Median ' + format.format(value) + ' €, Bandbreite ' + format.format(low) + ' bis ' + format.format(high) + ' €' : format.format(value) + ' €';
    return '<div class="plot-row' + (label === 'Kaufangebot' ? ' plot-offer' : '') + '"><span class="plot-name">' + labelText + '</span><span class="plot-track" aria-hidden="true">' + interval + '<i class="plot-point" style="--point:' + percent(value) + '%"></i></span><strong aria-hidden="true">' + format.format(value) + ' €</strong><span class="sr-only">' + description + '</span></div>';
  }).join('');
  return '<figure class="chart" style="--tick-width:' + (100 / tickCount) + '%" aria-labelledby="chart-caption"><figcaption id="chart-caption" class="chart-title">Wert je Aktie im Vergleich</figcaption>' + rows + '<div class="chart-axis" aria-hidden="true"><div class="axis-labels">' + ticks + '</div></div><p class="chart-note">Werte in Euro. Die Linien zeigen die Spanne vom niedrigsten bis zum höchsten Peer-Multiplikator. Der Punkt auf jeder Linie markiert den Median.</p></figure>';
}

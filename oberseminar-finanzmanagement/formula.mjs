const addressPattern = /^(\$?)([A-Z]+)(\$?)([1-9]\d*)$/i;
const numberPattern = /^(?:\d{1,3}(?:\.\d{3})+,\d+|\d{1,3}(?:,\d{3})+\.\d+|\d{1,3}(?:\.\d{3}){2,}|\d{1,3}(?:,\d{3}){2,}|\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?/i;
const syntaxError = 'Bitte prüfen Sie die Schreibweise der Formel.';

function numberValue(token) {
  if (token.includes(',') && token.includes('.')) {
    token = token.lastIndexOf(',') > token.lastIndexOf('.')
      ? token.replace(/\./g, '').replace(',', '.') : token.replace(/,/g, '');
  } else if ((token.match(/[.,]/g) || []).length > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(token)) {
    token = token.replace(/[.,]/g, '');
  }
  const value = Number(token.replace(',', '.'));
  if (!Number.isFinite(value)) throw new Error('Die Zahl ist zu groß.');
  return value;
}

function columnName(number) {
  let name = '';
  while (number > 0) {
    const index = (number - 1) % 26;
    name = String.fromCharCode(65 + index) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function addressParts(address) {
  const [, fixedColumn, letters, fixedRow, digits] = address.match(addressPattern);
  let column = 0;
  for (const c of letters.toUpperCase()) column = column * 26 + c.charCodeAt(0) - 64;
  return { column, row: Number(digits), fixedColumn, fixedRow };
}

function translate(raw, dx, dy = 0) {
  const text = String(raw ?? '');
  if (!text.trimStart().startsWith('=')) return text;
  // Word boundaries keep the exponent in a scientific literal such as 1E6 intact.
  return text.replace(/(?<![a-z0-9_$.])(\$?[a-z]+\$?[1-9]\d*)(?![a-z0-9_])/gi, address => {
    const p = addressParts(address);
    const col = p.column + (p.fixedColumn ? 0 : dx);
    const row = p.row + (p.fixedRow ? 0 : dy);
    if (col < 1 || col > 16384 || row < 1 || row > 1048576) return '#BEZUG!';
    return p.fixedColumn + columnName(col) + p.fixedRow + row;
  });
}

function tokensFor(expression) {
  if (expression.length > 800) throw new Error('Die Formel ist zu lang.');
  // A copied Markdown multiplication or a typographic multiplication sign
  // represents the same operator as an asterisk typed on the keyboard.
  expression = expression.replace(/\\\*|[×·⋅]/g, '*').replace(/−/g, '-');
  const tokens = [];
  let cursor = 0;
  while (cursor < expression.length) {
    const rest = expression.slice(cursor);
    const space = /^\s+/.exec(rest);
    if (space) { cursor += space[0].length; continue; }
    if (/^#(?:BEZUG|REF)!/i.test(rest)) throw new Error('Ungültiger Zellbezug.');
    const ref = /^\$?[A-Z]+\$?[1-9]\d*/i.exec(rest);
    const num = numberPattern.exec(rest);
    const name = /^[A-Z]+/i.exec(rest);
    if (ref) {
      tokens.push({ type:'ref', value:ref[0].replace(/\$/g, '').toUpperCase() });
      cursor += ref[0].length;
    } else if (num) {
      tokens.push({ type:'number', value:numberValue(num[0]) });
      cursor += num[0].length;
    } else if (name) {
      tokens.push({ type:'name', value:name[0].toUpperCase() });
      cursor += name[0].length;
    } else if ('+-*/^%():;,'.includes(rest[0])) {
      tokens.push({ type:rest[0] });
      cursor++;
    } else throw new Error(syntaxError);
  }
  tokens.push({ type:'end' });
  return tokens;
}

function asNumber(value) {
  if (typeof value === 'string') throw new Error('Die Formel verwendet Text an einer Stelle, an der eine Zahl benötigt wird.');
  return value ?? 0;
}

function evaluateFormula(expression, read, valid, traceOnly = false) {
  const tokens = tokensFor(expression);
  let i = 0;
  function take(type) {
    if (tokens[i].type !== type) return false;
    i++;
    return true;
  }
  function expect(type) {
    if (!take(type)) throw new Error(syntaxError);
  }
  function readRange(first, last, collect) {
    if (!valid.has(first) || !valid.has(last)) throw new Error('Der Zellbereich liegt außerhalb des Arbeitsblatts.');
    const a = addressParts(first), b = addressParts(last);
    const width = Math.abs(a.column - b.column) + 1;
    const height = Math.abs(a.row - b.row) + 1;
    if (width * height > valid.size) throw new Error('Der Zellbereich ist zu groß.');
    for (let row = Math.min(a.row,b.row); row <= Math.max(a.row,b.row); row++)
      for (let col = Math.min(a.column,b.column); col <= Math.max(a.column,b.column); col++)
        collect(read(columnName(col) + row));
  }
  function aggregate(name) {
    expect('(');
    const numbers = [];
    const collect = value => { if (typeof value === 'number') numbers.push(value); };
    if (tokens[i].type !== ')') {
      do {
        if (tokens[i].type === 'ref' && tokens[i + 1].type === ':') {
          const first = tokens[i++].value;
          i++;
          const last = tokens[i].value;
          expect('ref');
          readRange(first, last, collect);
        } else collect(addition());
      } while (take(';') || take(','));
    }
    expect(')');
    if (name === 'SUM' || name === 'SUMME') return numbers.reduce((sum,n) => sum+n,0);
    if (name === 'MIN') return numbers.length ? Math.min(...numbers) : 0;
    if (name === 'MAX') return numbers.length ? Math.max(...numbers) : 0;
    if (name === 'MITTELWERT' || name === 'AVERAGE') {
      if (!numbers.length) throw new Error('Der Mittelwert benötigt mindestens einen Zahlenwert.');
      return numbers.reduce((sum,n) => sum+n,0)/numbers.length;
    }
    if (!numbers.length) throw new Error('Der Median benötigt mindestens einen Zahlenwert.');
    numbers.sort((a,b) => a-b);
    const middle = Math.floor(numbers.length/2);
    return numbers.length%2 ? numbers[middle] : (numbers[middle-1]+numbers[middle])/2;
  }
  function primary() {
    const token = tokens[i];
    if (take('number')) return token.value;
    if (take('ref')) return read(token.value);
    if (take('name')) {
      if (['SUM','SUMME','MIN','MAX','MEDIAN','MITTELWERT','AVERAGE'].includes(token.value)) return aggregate(token.value);
      throw new Error('Unbekannter Name „' + token.value + '“.');
    }
    if (take('(')) {
      const value = addition();
      expect(')');
      return value;
    }
    throw new Error(syntaxError);
  }
  function signedPercent() {
    if (take('+')) return asNumber(signedPercent());
    if (take('-')) return -asNumber(signedPercent());
    let value = primary();
    while (take('%')) value = asNumber(value) / 100;
    return value;
  }
  function power() {
    let value = signedPercent();
    while (take('^')) value = asNumber(value) ** asNumber(signedPercent());
    return value;
  }
  function product() {
    let value = power();
    for (;;) {
      if (take('*')) value = asNumber(value) * asNumber(power());
      else if (take('/')) {
        const denominator = asNumber(power());
        if (denominator === 0 && !traceOnly) throw new Error('Division durch null.');
        value = asNumber(value) / denominator;
      } else return value;
    }
  }
  function addition() {
    let value = product();
    for (;;) {
      if (take('+')) value = asNumber(value) + asNumber(product());
      else if (take('-')) value = asNumber(value) - asNumber(product());
      else return value;
    }
  }
  const value = addition();
  expect('end');
  if (!traceOnly && typeof value === 'number' && !Number.isFinite(value)) throw new Error('Das Ergebnis ist keine endliche Zahl.');
  return value;
}

function references(rawFormula, validAddresses) {
  const text = String(rawFormula ?? '').trim();
  if (!text.startsWith('=')) return new Set();
  const addresses = new Set();
  const valid = new Set(validAddresses);
  try {
    evaluateFormula(text.slice(1), address => {
      if (!valid.has(address)) throw new Error('Ungültiger Zellbezug.');
      addresses.add(address);
      return 1;
    }, valid, true);
    return addresses;
  } catch {
    return new Set();
  }
}

function literalValue(text) {
  if (text.startsWith("'")) return text.slice(1);
  if (!text) return null;
  const normalized = text.replace(/−/g, '-');
  const amount = normalized.match(/^([+-]?)\s*(?:(€|EUR)\s*)?([\d.,][\d.,\s]*(?:[eE][+-]?\d+)?)\s*(%|€|EUR|Euro|Stück|Stk\.?|pcs\.?|[×x])?$/iu);
  if (!amount) return text;
  const [, sign, prefix, number, suffix] = amount;
  if (prefix && suffix) return text;
  let token = number.trim();
  if (/\s/.test(token)) {
    if (!/^\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?$/.test(token)) return text;
    token = token.replace(/\s/g, '');
  }
  if (numberPattern.exec(token)?.[0] !== token) return text;
  return numberValue(token) * (sign === '-' ? -1 : 1) / (suffix === '%' ? 100 : 1);
}

function calculate(rawByAddress, validAddresses) {
  const output = {};
  const valid = new Set(validAddresses);
  const active = new Set();
  function resolve(address) {
    if (!valid.has(address)) throw new Error('Ungültiger Zellbezug auf ' + address + '.');
    if (Object.hasOwn(output,address)) return output[address];
    if (active.has(address)) throw new Error('Zirkelbezug über ' + address + '.');
    const raw = rawByAddress instanceof Map ? rawByAddress.get(address) : rawByAddress[address];
    const text = String(raw ?? '').trim();
    active.add(address);
    try {
      let value = null;
      if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) throw new Error('Die Zahl ist zu groß.');
        value = raw;
      } else if (text.startsWith('=')) {
        value = evaluateFormula(text.slice(1), target => {
          const result = resolve(target);
          if (result.error) throw new Error(result.error);
          return result.value;
        },valid);
        if (value === null) value = 0;
      } else value = literalValue(text);
      output[address] = { value };
    } catch (error) {
      output[address] = { value:null, error:error.message };
    } finally {
      active.delete(address);
    }
    return output[address];
  }
  for (const address of valid) resolve(address);
  return output;
}

export { calculate, references, translate };

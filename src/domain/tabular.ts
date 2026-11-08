export const MAX_TABULAR_BYTES = 200_000;
export const MAX_TABULAR_ROWS = 200;
export const MAX_TABULAR_COLUMNS = 30;
export type ParsedTable = { rows: string[][]; truncated: boolean };
export function delimiterForName(name: string): ',' | '\t' {
  return /\.(?:tsv|tab)$/i.test(name) ? '\t' : ',';
}
export function parseDelimited(text: string, delimiter: ',' | '\t' | ';'): ParsedTable {
  const sourceTruncated = text.length > MAX_TABULAR_BYTES,
    source = text.slice(0, MAX_TABULAR_BYTES),
    rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    quoteClosed = false,
    recordStarted = false,
    truncated = sourceTruncated;
  const pushField = () => {
    if (row.length < MAX_TABULAR_COLUMNS) row.push(field);
    else truncated = true;
    field = '';
    quoteClosed = false;
  };
  const pushRecord = () => {
    pushField();
    if (rows.length < MAX_TABULAR_ROWS) rows.push(row);
    else truncated = true;
    row = [];
    recordStarted = false;
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else if (c === '\r' && source[i + 1] === '\n') {
        field += '\n';
        i++;
      } else field += c;
      recordStarted = true;
      continue;
    }
    if (c === '"' && !field && !quoteClosed) {
      quoted = true;
      recordStarted = true;
      continue;
    }
    if (c === delimiter) {
      pushField();
      recordStarted = true;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && source[i + 1] === '\n') i++;
      pushRecord();
      continue;
    }
    field += c;
    recordStarted = true;
  }
  if (recordStarted || row.length || field.length) pushRecord();
  return { rows, truncated };
}
export function inferDelimiter(text: string, name: string): ',' | '\t' | ';' {
  if (delimiterForName(name) === '\t') return '\t';
  let quote = false;
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (let i = 0; i < Math.min(text.length, 5000); i++) {
    const c = text[i]!;
    if (c === '"') {
      if (quote && text[i + 1] === '"') i++;
      else quote = !quote;
    } else if (!quote) {
      if (c === '\r' || c === '\n') break;
      if (c === ',' || c === ';' || c === '\t') counts[c]++;
    }
  }
  return counts[';'] > counts[','] && counts[';'] >= counts['\t']
    ? ';'
    : counts['\t'] > counts[',']
      ? '\t'
      : ',';
}

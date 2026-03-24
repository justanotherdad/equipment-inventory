/** Minimal CSV parser: supports quoted fields, commas inside quotes, and newlines inside quotes. */

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        cur += c;
      }
    } else if (!inQuotes && (c === '\n' || (c === '\r' && text[i + 1] === '\n'))) {
      if (c === '\r') i++;
      records.push(cur);
      cur = '';
    } else if (!inQuotes && c === '\r') {
      records.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  records.push(cur);
  return records;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = text.replace(/^\uFEFF/, '');
  const rawLines = splitCsvRecords(normalized).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(rawLines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < rawLines.length; r++) {
    const cells = parseCsvLine(rawLines[r]);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (cells[c] ?? '').trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

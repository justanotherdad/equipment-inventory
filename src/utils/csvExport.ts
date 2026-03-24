/** Escape a value for CSV (RFC 4180-style). */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map((c) => escapeCsvCell(c)).join(',');
}

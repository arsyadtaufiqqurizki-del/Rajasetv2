import Papa from 'papaparse';

// Guards against CSV-formula injection: a leading =, +, -, @, tab, or CR gets
// Excel/Sheets to execute the cell as a formula unless prefixed with a quote.
export function sanitizeCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsvBlob(rows: Record<string, unknown>[]): Blob {
  return new Blob([Papa.unparse(rows)], { type: 'text/csv;charset=utf-8;' });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

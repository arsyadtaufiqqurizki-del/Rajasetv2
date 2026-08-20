/** Strips currency symbols, commas, and whitespace, then parses a cost value. Returns 0 for invalid or empty input. */
export function parseCost(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const numeric = parseFloat(value.replace(/[^0-9.-]+/g, ''));
  return isNaN(numeric) ? 0 : numeric;
}

/** "$1,234.56" — 2 decimals always, '-' on invalid or empty input. */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(numeric)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

/** "$1,235" — whole dollars, no cents. */
export function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/** "$1.2M" — compact notation for large totals (KPI cards). */
export function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** "1.2M" — compact notation, no currency symbol (chart axis ticks). */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

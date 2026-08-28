/** "$1.2M" / "$1.2K" / "$500" — used for chart Y-axis ticks across all three report types. */
export function compactCurrencyAxisFormatter(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val}`;
}

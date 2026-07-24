import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

/** Full months elapsed from `from` to `to`, floored at 0. */
export function monthsBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Quarter-end dates (with labels) falling within [start, end]. Falls back to end's own quarter if none fit. */
export function getQuartersInRange(start: Date, end: Date): { label: string; endDate: Date }[] {
  const quarters: { label: string; endDate: Date }[] = [];
  let year = start.getFullYear();
  let quarter = Math.floor(start.getMonth() / 3);

  while (true) {
    const endDate = new Date(year, quarter * 3 + 3, 0);
    if (endDate > end) break;
    quarters.push({ label: `Q${quarter + 1} ${year}`, endDate });
    quarter++;
    if (quarter > 3) {
      quarter = 0;
      year++;
    }
  }

  if (quarters.length === 0) {
    const q = Math.floor(end.getMonth() / 3);
    const y = end.getFullYear();
    quarters.push({ label: `Q${q + 1} ${y}`, endDate: new Date(y, q * 3 + 3, 0) });
  }

  return quarters;
}

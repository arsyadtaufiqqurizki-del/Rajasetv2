/** Formats a "YYYY-MM-DD" string (e.g. from a native date input) as "DD/MM/YYYY". Returns the input unchanged if it doesn't match. */
export function formatDateDMY(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Formats a Date as "Weekday, Month day, year · HH:mm". */
export function formatLastUpdate(date: Date): string {
  const datePart = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart} · ${timePart}`;
}

/** Midnight today — a stable value for useMemo dependencies. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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

/** Days in a 1-based month, leap-year aware. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Two-digit years follow the Postgres/POSIX pivot: 00-69 -> 2000s, 70-99 -> 1900s. */
function expandTwoDigitYear(yy: number): number {
  return yy <= 69 ? 2000 + yy : 1900 + yy;
}

/** Validates a calendar date and renders it as zero-padded "YYYY-MM-DD". Null when out of range. */
function toIsoDate(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Normalizes a free-text date from a CSV cell to "YYYY-MM-DD" for Postgres DATE
 * columns. Accepts ISO ("2024-03-28", tolerating a trailing time part),
 * "YYYY/MM/DD", and Indonesian "DD-MM-YYYY"/"DD/MM/YYYY" including two-digit
 * years ("28-03-19" -> "2019-03-28"). Returns '' for a blank cell and null when
 * the value is not a real calendar date, so callers can reject it up front with
 * a clear message instead of surfacing a Postgres error per row.
 */
export function normalizeImportDate(value: string | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(raw);
  if (iso) return toIsoDate(iso[1], iso[2], iso[3]);

  const slashIso = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(raw);
  if (slashIso) return toIsoDate(slashIso[1], slashIso[2], slashIso[3]);

  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(raw);
  if (dmy) {
    const year = dmy[3].length === 2 ? String(expandTwoDigitYear(Number(dmy[3]))) : dmy[3];
    return toIsoDate(year, dmy[2], dmy[1]);
  }

  return null;
}

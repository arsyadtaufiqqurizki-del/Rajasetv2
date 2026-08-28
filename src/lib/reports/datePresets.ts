import { id as copy } from '../../i18n/id';

export type DatePreset = 'ytd' | 'thisQuarter' | 'lastQuarter' | 'lastYear' | 'custom';

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'ytd', label: copy.reports.datePresets.ytd },
  { value: 'thisQuarter', label: copy.reports.datePresets.thisQuarter },
  { value: 'lastQuarter', label: copy.reports.datePresets.lastQuarter },
  { value: 'lastYear', label: copy.reports.datePresets.lastYear },
  { value: 'custom', label: copy.reports.datePresets.custom },
];

const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Resolves a preset to a concrete date range. Returns null for 'custom' — the caller owns those dates. */
export function resolveDatePreset(preset: DatePreset, base: Date = new Date()): { start: string; end: string } | null {
  const year = base.getFullYear();
  switch (preset) {
    case 'ytd':
      return { start: `${year}-01-01`, end: toIso(base) };
    case 'thisQuarter': {
      const quarter = Math.floor(base.getMonth() / 3);
      return { start: toIso(new Date(year, quarter * 3, 1)), end: toIso(base) };
    }
    case 'lastQuarter': {
      const quarter = Math.floor(base.getMonth() / 3) - 1;
      const normQuarter = ((quarter % 4) + 4) % 4;
      const quarterYear = quarter < 0 ? year - 1 : year;
      return {
        start: toIso(new Date(quarterYear, normQuarter * 3, 1)),
        end: toIso(new Date(quarterYear, normQuarter * 3 + 3, 0)),
      };
    }
    case 'lastYear':
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
    case 'custom':
      return null;
  }
}

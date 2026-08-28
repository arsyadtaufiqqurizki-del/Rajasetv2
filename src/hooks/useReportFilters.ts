import { useEffect, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { parseListParam } from '../lib/utils';
import { REPORT_TYPES, type ReportType } from '../types/report';
import { DATE_PRESET_OPTIONS, resolveDatePreset, type DatePreset } from '../lib/reports/datePresets';
import type { FilterChip } from '../types/filters';
import { id as copy } from '../i18n/id';

function initDates(searchParams: URLSearchParams) {
  const rawPreset = searchParams.get('period');
  const preset = (DATE_PRESET_OPTIONS.some(o => o.value === rawPreset) ? rawPreset : 'ytd') as DatePreset;
  const resolved = resolveDatePreset(preset);
  const fallback = resolveDatePreset('ytd')!;
  return {
    preset,
    start: resolved?.start ?? searchParams.get('from') ?? fallback.start,
    end: resolved?.end ?? searchParams.get('to') ?? fallback.end,
  };
}

/**
 * Owns Reports' configuration state (report type, subsidiary/category/location/status,
 * period) and syncs it to the URL, mirroring useListFilters' pattern — but Reports builds
 * an on-demand artefact rather than filtering a live list, so it doesn't share that hook.
 */
export function useReportFilters(searchParams: URLSearchParams, setSearchParams: SetURLSearchParams) {
  const [reportType, setReportType] = useState<ReportType>(() => {
    const raw = searchParams.get('type');
    return (REPORT_TYPES as string[]).includes(raw ?? '') ? (raw as ReportType) : REPORT_TYPES[0];
  });

  const [filterSubsidiary, setFilterSubsidiary] = useState<string[]>(() => parseListParam(searchParams, 'sub'));
  const [filterCategory, setFilterCategory] = useState<string[]>(() => parseListParam(searchParams, 'cat'));
  const [filterLocation, setFilterLocation] = useState<string[]>(() => parseListParam(searchParams, 'loc'));
  const [filterStatus, setFilterStatus] = useState<string[]>(() => parseListParam(searchParams, 'status'));

  const [{ preset: initPreset, start: initStart, end: initEnd }] = useState(() => initDates(searchParams));
  const [datePreset, setDatePresetRaw] = useState<DatePreset>(initPreset);
  const [dateStart, setDateStartRaw] = useState(initStart);
  const [dateEnd, setDateEndRaw] = useState(initEnd);

  const setDatePreset = (preset: DatePreset) => {
    setDatePresetRaw(preset);
    const resolved = resolveDatePreset(preset);
    if (resolved) {
      setDateStartRaw(resolved.start);
      setDateEndRaw(resolved.end);
    }
  };

  // Editing a date directly means the user wants a custom range, even if a preset was active.
  const setDateStart = (value: string) => {
    setDateStartRaw(value);
    setDatePresetRaw('custom');
  };
  const setDateEnd = (value: string) => {
    setDateEndRaw(value);
    setDatePresetRaw('custom');
  };

  const dateError = dateStart && dateEnd && dateEnd < dateStart
    ? copy.reports.filterBar.dateRangeError
    : null;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('type', reportType);
    if (filterSubsidiary.length) params.set('sub', filterSubsidiary.join(','));
    if (filterCategory.length) params.set('cat', filterCategory.join(','));
    if (filterLocation.length) params.set('loc', filterLocation.join(','));
    if (filterStatus.length) params.set('status', filterStatus.join(','));
    params.set('period', datePreset);
    if (datePreset === 'custom') {
      if (dateStart) params.set('from', dateStart);
      if (dateEnd) params.set('to', dateEnd);
    }
    setSearchParams(params, { replace: true });
  }, [reportType, filterSubsidiary, filterCategory, filterLocation, filterStatus, datePreset, dateStart, dateEnd, setSearchParams]);

  const chips = useMemo(() => {
    const result: FilterChip[] = [];
    const pushMulti = (label: string, values: string[], setter: (v: string[]) => void) => {
      values.forEach(v => result.push({
        id: `${label}-${v}`,
        label: `${label}: ${v}`,
        onRemove: () => setter(values.filter(x => x !== v)),
      }));
    };
    pushMulti(copy.reports.chipLabels.subsidiary, filterSubsidiary, setFilterSubsidiary);
    pushMulti(copy.reports.chipLabels.category, filterCategory, setFilterCategory);
    pushMulti(copy.reports.chipLabels.location, filterLocation, setFilterLocation);
    pushMulti(copy.reports.chipLabels.status, filterStatus, setFilterStatus);

    const presetLabel = DATE_PRESET_OPTIONS.find(o => o.value === datePreset)?.label ?? datePreset;
    const periodLabel = copy.reports.chipLabels.period;
    result.push({
      id: 'period',
      label: datePreset === 'custom' ? `${periodLabel}: ${dateStart || '…'} → ${dateEnd || '…'}` : `${periodLabel}: ${presetLabel}`,
      onRemove: () => setDatePreset('ytd'),
    });

    return result;
  }, [filterSubsidiary, filterCategory, filterLocation, filterStatus, datePreset, dateStart, dateEnd]);

  const clearFilters = () => {
    setFilterSubsidiary([]);
    setFilterCategory([]);
    setFilterLocation([]);
    setFilterStatus([]);
    setDatePreset('ytd');
  };

  return {
    reportType, setReportType,
    filterSubsidiary, setFilterSubsidiary,
    filterCategory, setFilterCategory,
    filterLocation, setFilterLocation,
    filterStatus, setFilterStatus,
    datePreset, setDatePreset,
    dateStart, setDateStart,
    dateEnd, setDateEnd,
    dateError,
    chips,
    clearFilters,
  };
}

import { useState, useMemo, useEffect } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { parseListParam } from '../lib/utils';
import type { FilterChip } from '../types/filters';

interface MultiFilterDef<T> {
  kind: 'multi';
  /** URL param name and internal lookup key */
  key: string;
  /** chip label prefix, e.g. "Subsidiary" */
  label: string;
  accessor: (row: T) => string;
}

interface DateRangeFilterDef<T> {
  kind: 'dateRange';
  /** base URL param name; produces `${key}From` / `${key}To` */
  key: string;
  label: string;
  /** ISO-ish date string ('YYYY-MM-DD'), compared lexically */
  accessor: (row: T) => string;
}

interface NumberRangeFilterDef<T> {
  kind: 'numberRange';
  /** base URL param name; produces `${key}Min` / `${key}Max` */
  key: string;
  label: string;
  accessor: (row: T) => number;
}

export type FilterDef<T> = MultiFilterDef<T> | DateRangeFilterDef<T> | NumberRangeFilterDef<T>;

export interface UseListFiltersOptions<T> {
  rows: T[];
  defs: FilterDef<T>[];
  /** fields searched against the (debounced) free-text query, case-insensitively */
  searchFields: (row: T) => string[];
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  /** called whenever any filter or the debounced search query changes, e.g. to reset pagination */
  onFiltersChanged?: () => void;
}

type DateRange = { from: string; to: string };
type NumberRange = { min: string; max: string };

const EMPTY_DATE_RANGE: DateRange = { from: '', to: '' };
const EMPTY_NUMBER_RANGE: NumberRange = { min: '', max: '' };

/**
 * The one filter engine, configured per page via `defs`. Owns debounced search, URL sync,
 * chip generation, page-reset notification, and row filtering — previously reimplemented
 * per-page (see refactoring_plan.md section 2.1).
 */
export function useListFilters<T>({
  rows,
  defs,
  searchFields,
  searchParams,
  setSearchParams,
  onFiltersChanged,
}: UseListFiltersOptions<T>) {
  const multiDefs = useMemo(() => defs.filter((d): d is MultiFilterDef<T> => d.kind === 'multi'), [defs]);
  const dateDefs = useMemo(() => defs.filter((d): d is DateRangeFilterDef<T> => d.kind === 'dateRange'), [defs]);
  const numberDefs = useMemo(() => defs.filter((d): d is NumberRangeFilterDef<T> => d.kind === 'numberRange'), [defs]);

  const [multiValues, setMultiValues] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const def of multiDefs) initial[def.key] = parseListParam(searchParams, def.key);
    return initial;
  });

  const [dateRanges, setDateRanges] = useState<Record<string, DateRange>>(() => {
    const initial: Record<string, DateRange> = {};
    for (const def of dateDefs) {
      initial[def.key] = {
        from: searchParams.get(`${def.key}From`) || '',
        to: searchParams.get(`${def.key}To`) || '',
      };
    }
    return initial;
  });

  const [numberRanges, setNumberRanges] = useState<Record<string, NumberRange>>(() => {
    const initial: Record<string, NumberRange> = {};
    for (const def of numberDefs) {
      initial[def.key] = {
        min: searchParams.get(`${def.key}Min`) || '',
        max: searchParams.get(`${def.key}Max`) || '',
      };
    }
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => searchParams.get('q') || '');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const setMulti = (key: string, values: string[]) => {
    setMultiValues((prev) => ({ ...prev, [key]: values }));
  };

  const setDateRange = (key: string, from: string, to: string) => {
    setDateRanges((prev) => ({ ...prev, [key]: { from, to } }));
  };

  // Read the *previous* range via the state updater rather than a closed-over value, so that
  // setDateFrom/setDateTo called back-to-back in the same event (e.g. two field updates in one
  // handler) don't clobber each other with stale data.
  const setDateFrom = (key: string, from: string) => {
    setDateRanges((prev) => ({ ...prev, [key]: { from, to: prev[key]?.to ?? '' } }));
  };

  const setDateTo = (key: string, to: string) => {
    setDateRanges((prev) => ({ ...prev, [key]: { from: prev[key]?.from ?? '', to } }));
  };

  const setNumberRange = (key: string, min: string, max: string) => {
    setNumberRanges((prev) => ({ ...prev, [key]: { min, max } }));
  };

  const setNumberMin = (key: string, min: string) => {
    setNumberRanges((prev) => ({ ...prev, [key]: { min, max: prev[key]?.max ?? '' } }));
  };

  const setNumberMax = (key: string, max: string) => {
    setNumberRanges((prev) => ({ ...prev, [key]: { min: prev[key]?.min ?? '', max } }));
  };

  // Content-based signature so the two effects below fire once per actual filter change,
  // regardless of how many (dynamically-configured) filter defs a page declares.
  const filterSignature = JSON.stringify({ multiValues, dateRanges, numberRanges, debouncedSearchQuery });

  // Reset page to 1 when filters change
  useEffect(() => {
    onFiltersChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    for (const def of multiDefs) {
      const v = multiValues[def.key] ?? [];
      if (v.length > 0) params.set(def.key, v.join(','));
    }
    for (const def of dateDefs) {
      const r = dateRanges[def.key] ?? EMPTY_DATE_RANGE;
      if (r.from) params.set(`${def.key}From`, r.from);
      if (r.to) params.set(`${def.key}To`, r.to);
    }
    for (const def of numberDefs) {
      const r = numberRanges[def.key] ?? EMPTY_NUMBER_RANGE;
      if (r.min) params.set(`${def.key}Min`, r.min);
      if (r.max) params.set(`${def.key}Max`, r.max);
    }
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature, setSearchParams]);

  const chips = useMemo(() => {
    const result: FilterChip[] = [];
    for (const def of multiDefs) {
      const values = multiValues[def.key] ?? [];
      values.forEach((v) =>
        result.push({
          id: `${def.key}-${v}`,
          label: `${def.label}: ${v}`,
          onRemove: () => setMulti(def.key, (multiValues[def.key] ?? []).filter((x) => x !== v)),
        })
      );
    }
    for (const def of dateDefs) {
      const r = dateRanges[def.key] ?? EMPTY_DATE_RANGE;
      if (r.from || r.to) {
        result.push({
          id: def.key,
          label: `${def.label}: ${r.from || '…'} → ${r.to || '…'}`,
          onRemove: () => setDateRange(def.key, '', ''),
        });
      }
    }
    for (const def of numberDefs) {
      const r = numberRanges[def.key] ?? EMPTY_NUMBER_RANGE;
      if (r.min || r.max) {
        result.push({
          id: def.key,
          label: `${def.label}: ${r.min || '0'} - ${r.max || '∞'}`,
          onRemove: () => setNumberRange(def.key, '', ''),
        });
      }
    }
    if (debouncedSearchQuery) {
      result.push({ id: 'search', label: `Search: "${debouncedSearchQuery}"`, onRemove: () => setSearchQuery('') });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiValues, dateRanges, numberRanges, debouncedSearchQuery]);

  const filtered = useMemo(() => {
    const parsedNumberRanges = numberDefs.map((def) => {
      const r = numberRanges[def.key] ?? EMPTY_NUMBER_RANGE;
      return {
        def,
        min: r.min === '' ? null : parseFloat(r.min),
        max: r.max === '' ? null : parseFloat(r.max),
      };
    });

    return rows.filter((row) => {
      for (const def of multiDefs) {
        const selected = multiValues[def.key] ?? [];
        if (selected.length > 0 && !selected.includes(def.accessor(row))) return false;
      }
      for (const def of dateDefs) {
        const r = dateRanges[def.key] ?? EMPTY_DATE_RANGE;
        const value = def.accessor(row);
        if (r.from && value < r.from) return false;
        if (r.to && value > r.to) return false;
      }
      for (const { def, min, max } of parsedNumberRanges) {
        const value = def.accessor(row);
        if (min !== null && value < min) return false;
        if (max !== null && value > max) return false;
      }
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        if (!searchFields(row).some((field) => field.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, multiValues, dateRanges, numberRanges, debouncedSearchQuery, searchFields]);

  const clearFilters = () => {
    setMultiValues(Object.fromEntries(multiDefs.map((d) => [d.key, []])));
    setDateRanges(Object.fromEntries(dateDefs.map((d) => [d.key, { from: '', to: '' }])));
    setNumberRanges(Object.fromEntries(numberDefs.map((d) => [d.key, { min: '', max: '' }])));
    setSearchQuery('');
  };

  return {
    getMulti: (key: string) => multiValues[key] ?? [],
    setMulti,
    getDateRange: (key: string) => dateRanges[key] ?? EMPTY_DATE_RANGE,
    setDateRange,
    setDateFrom,
    setDateTo,
    getNumberRange: (key: string) => numberRanges[key] ?? EMPTY_NUMBER_RANGE,
    setNumberRange,
    setNumberMin,
    setNumberMax,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    chips,
    filtered,
    clearFilters,
  };
}

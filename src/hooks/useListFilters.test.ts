import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useListFilters, type FilterDef } from './useListFilters';

interface Row {
  id: string;
  category: string;
  region: string;
  cost: number;
  date: string;
  name: string;
}

const ROWS: Row[] = [
  { id: '1', category: 'A', region: 'North', cost: 100, date: '2024-01-10', name: 'Alpha Widget' },
  { id: '2', category: 'B', region: 'South', cost: 250, date: '2024-06-15', name: 'Beta Gadget' },
  { id: '3', category: 'A', region: 'South', cost: 50, date: '2023-12-01', name: 'Gamma Widget' },
];

const DEFS: FilterDef<Row>[] = [
  { kind: 'multi', key: 'category', label: 'Category', accessor: (r) => r.category },
  { kind: 'multi', key: 'region', label: 'Region', accessor: (r) => r.region },
  { kind: 'dateRange', key: 'date', label: 'Date', accessor: (r) => r.date },
  { kind: 'numberRange', key: 'cost', label: 'Cost', accessor: (r) => r.cost },
];

const searchFields = (r: Row) => [r.name];
const ids = (rows: Row[]) => rows.map((r) => r.id);

function setup(initialQuery = '', onFiltersChanged = vi.fn()) {
  const initialParams = new URLSearchParams(initialQuery);
  const setSearchParams = vi.fn() as unknown as SetURLSearchParams;
  const { result } = renderHook(() =>
    useListFilters({ rows: ROWS, defs: DEFS, searchFields, searchParams: initialParams, setSearchParams, onFiltersChanged })
  );
  return { result, setSearchParams, onFiltersChanged };
}

describe('useListFilters', () => {
  it('returns every row when no filters are applied', () => {
    const { result } = setup();
    expect(ids(result.current.filtered)).toEqual(['1', '2', '3']);
  });

  it('filters a multi-select dimension (OR within dimension)', () => {
    const { result } = setup();
    act(() => result.current.setMulti('region', ['South']));
    expect(ids(result.current.filtered)).toEqual(['2', '3']);
  });

  it('combines dimensions with AND', () => {
    const { result } = setup();
    act(() => {
      result.current.setMulti('category', ['A']);
      result.current.setMulti('region', ['South']);
    });
    expect(ids(result.current.filtered)).toEqual(['3']);
  });

  it('filters by date range with inclusive bounds', () => {
    const { result } = setup();
    act(() => result.current.setDateRange('date', '2024-01-01', '2024-12-31'));
    expect(ids(result.current.filtered)).toEqual(['1', '2']);
  });

  it('filters by number range with inclusive bounds', () => {
    const { result } = setup();
    act(() => result.current.setNumberRange('cost', '60', '200'));
    expect(ids(result.current.filtered)).toEqual(['1']);
  });

  it('matches the free-text search field', () => {
    const { result } = setup();
    act(() => result.current.setSearchQuery('gadget'));
    // debounced query hasn't caught up yet
    expect(ids(result.current.filtered)).toEqual(['1', '2', '3']);
  });

  it('restores filter state from the URL on mount', () => {
    const { result } = setup('category=A%2CB&regionFrom=x&costMin=60&costMax=200&q=widget');
    expect(result.current.getMulti('category')).toEqual(['A', 'B']);
    expect(result.current.getNumberRange('cost')).toEqual({ min: '60', max: '200' });
    expect(result.current.searchQuery).toBe('widget');
  });

  it('writes the current filter state back to the URL', () => {
    const { result, setSearchParams } = setup();
    act(() => {
      result.current.setMulti('category', ['A']);
      result.current.setDateRange('date', '2024-01-01', '');
    });
    expect(setSearchParams).toHaveBeenCalled();
    const lastCall = (setSearchParams as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const params = lastCall![0] as URLSearchParams;
    expect(params.get('category')).toBe('A');
    expect(params.get('dateFrom')).toBe('2024-01-01');
    expect(lastCall![1]).toEqual({ replace: true });
  });

  it('a URL saved with filters applied restores the same result set', () => {
    const first = setup();
    act(() => {
      first.result.current.setMulti('region', ['South']);
      first.result.current.setNumberRange('cost', '', '200');
    });
    const savedParams = (first.setSearchParams as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as URLSearchParams;

    const restored = renderHook(() =>
      useListFilters({
        rows: ROWS,
        defs: DEFS,
        searchFields,
        searchParams: savedParams,
        setSearchParams: vi.fn() as unknown as SetURLSearchParams,
      })
    );
    expect(ids(restored.result.current.filtered)).toEqual(ids(first.result.current.filtered));
  });

  it('produces one removable chip per active filter value, plus one for search', () => {
    const { result } = setup('q=widget');
    act(() => {
      result.current.setMulti('category', ['A']);
      result.current.setMulti('region', ['North', 'South']);
    });
    const labels = result.current.chips.map((c) => c.label).sort();
    expect(labels).toEqual([
      'Category: A',
      'Region: North',
      'Region: South',
      'Search: "widget"',
    ].sort());

    const regionChip = result.current.chips.find((c) => c.label === 'Region: North')!;
    act(() => regionChip.onRemove());
    expect(result.current.getMulti('region')).toEqual(['South']);
  });

  it('calls onFiltersChanged whenever a filter value changes', () => {
    const onFiltersChanged = vi.fn();
    const { result } = setup('', onFiltersChanged);
    onFiltersChanged.mockClear();
    act(() => result.current.setMulti('category', ['A']));
    expect(onFiltersChanged).toHaveBeenCalled();
  });

  it('clearFilters resets every dimension and the search query', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup('q=widget');
      act(() => {
        result.current.setMulti('category', ['A']);
        result.current.setDateRange('date', '2024-01-01', '2024-12-31');
        result.current.setNumberRange('cost', '60', '200');
      });
      expect(ids(result.current.filtered)).toEqual(['1']);
      act(() => result.current.clearFilters());
      act(() => vi.advanceTimersByTime(300));
      expect(ids(result.current.filtered)).toEqual(['1', '2', '3']);
      expect(result.current.chips).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

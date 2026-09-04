import { useMemo } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useListFilters, type FilterDef } from './useListFilters';
import type { Asset } from '../types/asset';

export function useDashboardFilters(
  assets: Asset[],
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  onFiltersChanged: () => void
) {
  const defs = useMemo<FilterDef<Asset>[]>(
    () => [
      { kind: 'multi', key: 'subsidiary', label: 'Subsidiary', accessor: (a) => a.subsidiary },
      { kind: 'multi', key: 'category', label: 'Asset Class', accessor: (a) => a.categorySegment1 },
      { kind: 'multi', key: 'location', label: 'Location', accessor: (a) => a.categorySegment2 },
      { kind: 'multi', key: 'status', label: 'Status', accessor: (a) => a.status },
      { kind: 'multi', key: 'listed', label: 'Listed', accessor: (a) => a.listed },
    ],
    []
  );

  const searchFields = useMemo(() => (a: Asset) => [a.assetDescription, a.assetNumber], []);

  const list = useListFilters({ rows: assets, defs, searchFields, searchParams, setSearchParams, onFiltersChanged });

  const uniqueStatuses = useMemo(() => Array.from(new Set(assets.map((a) => a.status).filter(Boolean))), [assets]);

  const recentFirst = useMemo(() => {
    const time = (a: Asset) => {
      const t = new Date(a.createdAt).getTime();
      return isNaN(t) ? 0 : t;
    };
    return [...list.filtered].sort((a, b) => time(b) - time(a));
  }, [list.filtered]);

  return {
    filterSubsidiary: list.getMulti('subsidiary'),
    setFilterSubsidiary: (v: string[]) => list.setMulti('subsidiary', v),
    filterCategory: list.getMulti('category'),
    setFilterCategory: (v: string[]) => list.setMulti('category', v),
    filterLocation: list.getMulti('location'),
    setFilterLocation: (v: string[]) => list.setMulti('location', v),
    filterStatus: list.getMulti('status'),
    setFilterStatus: (v: string[]) => list.setMulti('status', v),
    filterListed: list.getMulti('listed'),
    setFilterListed: (v: string[]) => list.setMulti('listed', v),
    searchQuery: list.searchQuery,
    setSearchQuery: list.setSearchQuery,
    debouncedSearchQuery: list.debouncedSearchQuery,
    uniqueStatuses,
    activeFilters: list.chips,
    filteredAssets: recentFirst,
    clearFilters: list.clearFilters,
  };
}

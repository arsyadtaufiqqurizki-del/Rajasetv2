import { useMemo } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useListFilters, type FilterDef } from './useListFilters';
import type { Reclassification } from '../types/reclassification';

export function useReclassificationFilters(
  reclassifications: Reclassification[],
  itemStatuses: string[],
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  onFiltersChanged: () => void
) {
  const defs = useMemo<FilterDef<Reclassification>[]>(
    () => [
      { kind: 'multi', key: 'category', label: 'Item Status', accessor: (r) => r.category },
      { kind: 'multi', key: 'verified', label: 'Verification', accessor: (r) => (r.verified ? 'Yes' : 'No') },
      { kind: 'multi', key: 'ownership', label: 'Ownership', accessor: (r) => r.ownership },
      { kind: 'multi', key: 'assetCategory', label: 'Asset Category', accessor: (r) => r.assetCategory },
      { kind: 'multi', key: 'location', label: 'Location', accessor: (r) => r.location },
    ],
    []
  );

  const searchFields = useMemo(() => (r: Reclassification) => [r.assetDescription, r.location], []);

  const list = useListFilters({ rows: reclassifications, defs, searchFields, searchParams, setSearchParams, onFiltersChanged });

  // Union of Asset Inventory's item_statuses lookup with whatever's actually in the
  // data, so filter options stay consistent with Inventory even if a reclassification
  // row has a category value not yet in the lookup table.
  const uniqueCategories = useMemo(
    () => Array.from(new Set([...itemStatuses, ...reclassifications.map((r) => r.category).filter(Boolean)])),
    [itemStatuses, reclassifications]
  );
  const uniqueOwnerships = useMemo(
    () => Array.from(new Set(reclassifications.map((r) => r.ownership).filter(Boolean))),
    [reclassifications]
  );
  const uniqueAssetCategories = useMemo(
    () => Array.from(new Set(reclassifications.map((r) => r.assetCategory).filter(Boolean))),
    [reclassifications]
  );
  const uniqueLocations = useMemo(
    () => Array.from(new Set(reclassifications.map((r) => r.location).filter(Boolean))),
    [reclassifications]
  );

  return {
    filterCategory: list.getMulti('category'),
    setFilterCategory: (v: string[]) => list.setMulti('category', v),
    filterVerified: list.getMulti('verified'),
    setFilterVerified: (v: string[]) => list.setMulti('verified', v),
    filterOwnership: list.getMulti('ownership'),
    setFilterOwnership: (v: string[]) => list.setMulti('ownership', v),
    filterAssetCategory: list.getMulti('assetCategory'),
    setFilterAssetCategory: (v: string[]) => list.setMulti('assetCategory', v),
    filterLocation: list.getMulti('location'),
    setFilterLocation: (v: string[]) => list.setMulti('location', v),
    searchQuery: list.searchQuery,
    setSearchQuery: list.setSearchQuery,
    debouncedSearchQuery: list.debouncedSearchQuery,
    uniqueCategories,
    uniqueOwnerships,
    uniqueAssetCategories,
    uniqueLocations,
    activeFilters: list.chips,
    filteredItems: list.filtered,
    clearFilters: list.clearFilters,
  };
}

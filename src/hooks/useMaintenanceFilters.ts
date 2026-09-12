import { useMemo } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useListFilters, type FilterDef } from './useListFilters';
import { parseCost } from '../lib/money';
import type { MaintenanceRecord } from '../types/maintenance';

/**
 * Upgrades Maintenance's filters to parity with the other list pages: multi-select
 * (was single "" sentinel), URL persistence, and chips — none of which existed before.
 * See refactoring_plan.md Step 6.5.
 */
export function useMaintenanceFilters(
  records: MaintenanceRecord[],
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  onFiltersChanged: () => void
) {
  const defs = useMemo<FilterDef<MaintenanceRecord>[]>(
    () => [
      { kind: 'multi', key: 'subsidiary', label: 'Subsidiary', accessor: (r) => r.subsidiary },
      { kind: 'multi', key: 'assetBook', label: 'Asset Book', accessor: (r) => r.assetBook },
      { kind: 'multi', key: 'status', label: 'Status', accessor: (r) => r.status },
    ],
    []
  );

  const searchFields = useMemo(() => (r: MaintenanceRecord) => [r.assetDescription, r.assetNumber], []);

  const sortAccessors = useMemo<Record<string, (r: MaintenanceRecord) => string | number>>(
    () => ({
      assetBook: (r) => r.assetBook || '',
      subsidiary: (r) => r.subsidiary,
      assetNumber: (r) => r.assetNumber,
      assetDescription: (r) => r.assetDescription,
      serviceType: (r) => r.serviceType,
      assetCategorySegment1: (r) => r.assetCategorySegment1,
      assetCategorySegment2: (r) => r.assetCategorySegment2,
      scheduledDate: (r) => r.scheduledDate,
      estimateCost: (r) => parseCost(r.estimateCost),
      actualCost: (r) => parseCost(r.actualCost),
      status: (r) => r.status,
    }),
    []
  );

  const list = useListFilters({ rows: records, defs, searchFields, searchParams, setSearchParams, onFiltersChanged, sortAccessors });

  const uniqueSubsidiaries = useMemo(() => Array.from(new Set(records.map((r) => r.subsidiary).filter(Boolean))), [records]);
  const uniqueAssetBooks = useMemo(() => Array.from(new Set(records.map((r) => r.assetBook).filter(Boolean))), [records]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(records.map((r) => r.status).filter(Boolean))), [records]);

  return {
    filterSubsidiary: list.getMulti('subsidiary'),
    setFilterSubsidiary: (v: string[]) => list.setMulti('subsidiary', v),
    filterAssetBook: list.getMulti('assetBook'),
    setFilterAssetBook: (v: string[]) => list.setMulti('assetBook', v),
    filterStatus: list.getMulti('status'),
    setFilterStatus: (v: string[]) => list.setMulti('status', v),
    searchQuery: list.searchQuery,
    setSearchQuery: list.setSearchQuery,
    debouncedSearchQuery: list.debouncedSearchQuery,
    sortKey: list.sortKey,
    sortDirection: list.sortDirection,
    toggleSort: list.toggleSort,
    sortableColumns: sortAccessors,
    uniqueSubsidiaries,
    uniqueAssetBooks,
    uniqueStatuses,
    activeFilters: list.chips,
    filteredRecords: list.filtered,
    clearFilters: list.clearFilters,
  };
}

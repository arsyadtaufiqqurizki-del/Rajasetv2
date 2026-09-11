import { useMemo } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useListFilters, type FilterDef } from './useListFilters';
import { parseCost } from '../lib/money';
import type { Asset } from '../contexts/AssetContext';

export type { FilterChip } from '../types/filters';

export interface AssetFilterValues {
  subsidiary: string[];
  category: string[];
  location: string[];
  status: string[];
  listed: string[];
  verification: string[];
  itemStatus: string[];
  dateFrom: string;
  dateTo: string;
  costMin: string;
  costMax: string;
  searchQuery: string;
}

export interface AssetFilterActions {
  setSubsidiary: (v: string[]) => void;
  setCategory: (v: string[]) => void;
  setLocation: (v: string[]) => void;
  setStatus: (v: string[]) => void;
  setListed: (v: string[]) => void;
  setVerification: (v: string[]) => void;
  setItemStatus: (v: string[]) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setCostMin: (v: string) => void;
  setCostMax: (v: string) => void;
  setSearchQuery: (v: string) => void;
  clearFilters: () => void;
}

const EMPTY_BOOK_VALUES: Map<string, number> = new Map();

export function useAssetFilters(
  assets: Asset[],
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  onFiltersChanged: () => void,
  bookValues: Map<string, number> = EMPTY_BOOK_VALUES
) {
  const defs = useMemo<FilterDef<Asset>[]>(
    () => [
      { kind: 'multi', key: 'subsidiary', label: 'Subsidiary', accessor: (a) => a.subsidiary },
      { kind: 'multi', key: 'category', label: 'Asset Class', accessor: (a) => a.categorySegment1 },
      { kind: 'multi', key: 'location', label: 'Location', accessor: (a) => a.categorySegment2 },
      { kind: 'multi', key: 'status', label: 'Status', accessor: (a) => a.status },
      { kind: 'multi', key: 'listed', label: 'Listed', accessor: (a) => a.listed },
      { kind: 'multi', key: 'verification', label: 'Verification', accessor: (a) => (a.verification ? 'Yes' : 'No') },
      { kind: 'multi', key: 'itemStatus', label: 'Item Status', accessor: (a) => a.itemStatus },
      { kind: 'dateRange', key: 'date', label: 'Date', accessor: (a) => a.datePlaceInService },
      { kind: 'numberRange', key: 'cost', label: 'Cost', accessor: (a) => parseCost(a.assetCost) },
    ],
    []
  );

  const searchFields = useMemo(() => (a: Asset) => [a.assetDescription, a.assetNumber], []);

  const sortAccessors = useMemo<Record<string, (a: Asset) => string | number>>(
    () => ({
      assetBook: (a) => a.assetBook || '',
      subsidiary: (a) => a.subsidiary,
      assetNumber: (a) => a.assetNumber,
      assetDescription: (a) => a.assetDescription,
      assetCost: (a) => parseCost(a.assetCost),
      bookValue: (a) => bookValues.get(a.id) ?? 0,
      datePlaceInService: (a) => a.datePlaceInService,
      assetUnits: (a) => Number(a.assetUnits) || 0,
      categorySegment1: (a) => a.categorySegment1,
      categorySegment2: (a) => a.categorySegment2,
      depreciationMethod: (a) => a.depreciationMethod,
      lifeInMonths: (a) => Number(a.lifeInMonths) || 0,
      listed: (a) => a.listed,
      status: (a) => a.status,
      verification: (a) => (a.verification ? 1 : 0),
      verificationDate: (a) => a.verificationDate,
      itemStatus: (a) => a.itemStatus,
    }),
    [bookValues]
  );

  const list = useListFilters({ rows: assets, defs, searchFields, searchParams, setSearchParams, onFiltersChanged, sortAccessors });

  const uniqueStatuses = useMemo(() => Array.from(new Set(assets.map((a) => a.status).filter(Boolean))), [assets]);

  const dateRange = list.getDateRange('date');
  const costRange = list.getNumberRange('cost');

  const filters: AssetFilterValues = {
    subsidiary: list.getMulti('subsidiary'),
    category: list.getMulti('category'),
    location: list.getMulti('location'),
    status: list.getMulti('status'),
    listed: list.getMulti('listed'),
    verification: list.getMulti('verification'),
    itemStatus: list.getMulti('itemStatus'),
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    costMin: costRange.min,
    costMax: costRange.max,
    searchQuery: list.searchQuery,
  };

  const actions: AssetFilterActions = {
    setSubsidiary: (v: string[]) => list.setMulti('subsidiary', v),
    setCategory: (v: string[]) => list.setMulti('category', v),
    setLocation: (v: string[]) => list.setMulti('location', v),
    setStatus: (v: string[]) => list.setMulti('status', v),
    setListed: (v: string[]) => list.setMulti('listed', v),
    setVerification: (v: string[]) => list.setMulti('verification', v),
    setItemStatus: (v: string[]) => list.setMulti('itemStatus', v),
    setDateFrom: (v: string) => list.setDateFrom('date', v),
    setDateTo: (v: string) => list.setDateTo('date', v),
    setCostMin: (v: string) => list.setNumberMin('cost', v),
    setCostMax: (v: string) => list.setNumberMax('cost', v),
    setSearchQuery: list.setSearchQuery,
    clearFilters: list.clearFilters,
  };

  return {
    filters,
    actions,
    debouncedSearchQuery: list.debouncedSearchQuery,
    sortKey: list.sortKey,
    sortDirection: list.sortDirection,
    toggleSort: list.toggleSort,
    sortableColumns: sortAccessors,
    uniqueStatuses,
    activeFilters: list.chips,
    filteredAssets: list.filtered,
    clearFilters: list.clearFilters,
  };
}

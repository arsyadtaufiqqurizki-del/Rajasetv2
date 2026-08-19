import { useState, useMemo, useEffect } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { parseListParam } from '../lib/utils';
import type { Asset } from '../contexts/AssetContext';

export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export function useAssetFilters(
  assets: Asset[],
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  onFiltersChanged: () => void
) {
  const [filterSubsidiary, setFilterSubsidiary] = useState<string[]>(() => parseListParam(searchParams, 'subsidiary'));
  const [filterCategory, setFilterCategory] = useState<string[]>(() => parseListParam(searchParams, 'category'));
  const [filterLocation, setFilterLocation] = useState<string[]>(() => parseListParam(searchParams, 'location'));
  const [filterStatus, setFilterStatus] = useState<string[]>(() => parseListParam(searchParams, 'status'));
  const [filterVerification, setFilterVerification] = useState<string[]>(() => parseListParam(searchParams, 'verification'));
  const [filterItemStatus, setFilterItemStatus] = useState<string[]>(() => parseListParam(searchParams, 'itemStatus'));
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') || "");
  const [costMin, setCostMin] = useState(() => searchParams.get('costMin') || "");
  const [costMax, setCostMax] = useState(() => searchParams.get('costMax') || "");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => searchParams.get('q') || "");

  const uniqueStatuses = useMemo(() => Array.from(new Set(assets.map(a => a.status).filter(Boolean))), [assets]);

  const activeFilters = useMemo(() => {
    const chips: FilterChip[] = [];
    filterSubsidiary.forEach(v => chips.push({ id: `sub-${v}`, label: `Subsidiary: ${v}`, onRemove: () => setFilterSubsidiary(prev => prev.filter(x => x !== v)) }));
    filterCategory.forEach(v => chips.push({ id: `cat-${v}`, label: `Asset Class: ${v}`, onRemove: () => setFilterCategory(prev => prev.filter(x => x !== v)) }));
    filterLocation.forEach(v => chips.push({ id: `loc-${v}`, label: `Location: ${v}`, onRemove: () => setFilterLocation(prev => prev.filter(x => x !== v)) }));
    filterStatus.forEach(v => chips.push({ id: `status-${v}`, label: `Status: ${v}`, onRemove: () => setFilterStatus(prev => prev.filter(x => x !== v)) }));
    filterVerification.forEach(v => chips.push({ id: `verif-${v}`, label: `Verification: ${v}`, onRemove: () => setFilterVerification(prev => prev.filter(x => x !== v)) }));
    filterItemStatus.forEach(v => chips.push({ id: `itemstatus-${v}`, label: `Item Status: ${v}`, onRemove: () => setFilterItemStatus(prev => prev.filter(x => x !== v)) }));
    if (dateFrom || dateTo) {
      chips.push({ id: 'date', label: `Date: ${dateFrom || '…'} → ${dateTo || '…'}`, onRemove: () => { setDateFrom(""); setDateTo(""); } });
    }
    if (costMin || costMax) {
      chips.push({ id: 'cost', label: `Cost: ${costMin || '0'} - ${costMax || '∞'}`, onRemove: () => { setCostMin(""); setCostMax(""); } });
    }
    if (debouncedSearchQuery) {
      chips.push({ id: 'search', label: `Search: "${debouncedSearchQuery}"`, onRemove: () => setSearchQuery("") });
    }
    return chips;
  }, [filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    onFiltersChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery]);

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterSubsidiary.length > 0) params.set('subsidiary', filterSubsidiary.join(','));
    if (filterCategory.length > 0) params.set('category', filterCategory.join(','));
    if (filterLocation.length > 0) params.set('location', filterLocation.join(','));
    if (filterStatus.length > 0) params.set('status', filterStatus.join(','));
    if (filterVerification.length > 0) params.set('verification', filterVerification.join(','));
    if (filterItemStatus.length > 0) params.set('itemStatus', filterItemStatus.join(','));
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (costMin) params.set('costMin', costMin);
    if (costMax) params.set('costMax', costMax);
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
    setSearchParams(params, { replace: true });
  }, [filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery, setSearchParams]);

  const filteredAssets = useMemo(() => {
    const min = costMin === "" ? null : parseFloat(costMin);
    const max = costMax === "" ? null : parseFloat(costMax);
    return assets.filter(asset => {
      const matchSubsidiary = filterSubsidiary.length === 0 || filterSubsidiary.includes(asset.subsidiary);
      const matchCategory = filterCategory.length === 0 || filterCategory.includes(asset.categorySegment1);
      const matchLocation = filterLocation.length === 0 || filterLocation.includes(asset.categorySegment2);
      const matchStatus = filterStatus.length === 0 || filterStatus.includes(asset.status);
      const matchVerification = filterVerification.length === 0 || filterVerification.includes(asset.verification ? 'Yes' : 'No');
      const matchItemStatus = filterItemStatus.length === 0 || filterItemStatus.includes(asset.itemStatus);
      const matchDateFrom = dateFrom === "" || asset.datePlaceInService >= dateFrom;
      const matchDateTo = dateTo === "" || asset.datePlaceInService <= dateTo;
      const cost = parseFloat(asset.assetCost.replace(/[^0-9.-]+/g, "")) || 0;
      const matchCostMin = min === null || cost >= min;
      const matchCostMax = max === null || cost <= max;
      const matchSearch = debouncedSearchQuery
        ? asset.assetDescription.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          asset.assetNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        : true;
      return matchSubsidiary && matchCategory && matchLocation && matchStatus && matchVerification && matchItemStatus && matchDateFrom && matchDateTo && matchCostMin && matchCostMax && matchSearch;
    });
  }, [assets, filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery]);

  const clearFilters = () => {
    setFilterSubsidiary([]);
    setFilterCategory([]);
    setFilterLocation([]);
    setFilterStatus([]);
    setFilterVerification([]);
    setFilterItemStatus([]);
    setDateFrom("");
    setDateTo("");
    setCostMin("");
    setCostMax("");
    setSearchQuery("");
  };

  return {
    filterSubsidiary, setFilterSubsidiary,
    filterCategory, setFilterCategory,
    filterLocation, setFilterLocation,
    filterStatus, setFilterStatus,
    filterVerification, setFilterVerification,
    filterItemStatus, setFilterItemStatus,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    costMin, setCostMin,
    costMax, setCostMax,
    searchQuery, setSearchQuery,
    debouncedSearchQuery,
    uniqueStatuses,
    activeFilters,
    filteredAssets,
    clearFilters,
  };
}

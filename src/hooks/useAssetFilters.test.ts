import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useAssetFilters } from './useAssetFilters';
import type { Asset } from '../contexts/AssetContext';

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    id: 'base',
    assetBook: 'Book A',
    subsidiary: 'Alpha',
    assetNumber: 'AN-000',
    assetDescription: 'Generic Asset',
    assetCost: '1000',
    datePlaceInService: '2024-01-01',
    assetUnits: '1',
    categorySegment1: 'IT Equipment',
    categorySegment2: 'HQ',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '36',
    listed: 'Yes',
    status: 'Active',
    statusLevel: 'success',
    verification: true,
    verificationDate: '2024-01-01',
    itemStatus: 'In Use',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ASSETS: Asset[] = [
  makeAsset({ id: '1', subsidiary: 'Alpha', categorySegment1: 'IT Equipment', categorySegment2: 'HQ', status: 'Active', assetCost: '$1,000.00', datePlaceInService: '2024-01-10', verification: true, assetDescription: 'Dell Laptop', assetNumber: 'AN-001' }),
  makeAsset({ id: '2', subsidiary: 'Beta', categorySegment1: 'Furniture', categorySegment2: 'Branch', status: 'Maintenance', assetCost: '$2,500.00', datePlaceInService: '2024-06-15', verification: false, assetDescription: 'Office Desk', assetNumber: 'AN-002' }),
  makeAsset({ id: '3', subsidiary: 'Alpha', categorySegment1: 'IT Equipment', categorySegment2: 'Branch', status: 'Broken', assetCost: '$500.00', datePlaceInService: '2023-12-01', verification: true, assetDescription: 'Old Printer', assetNumber: 'AN-003' }),
];

function setup(assets: Asset[], initialQuery = '') {
  const initialParams = new URLSearchParams(initialQuery);
  const setSearchParams = vi.fn() as unknown as SetURLSearchParams;
  const onFiltersChanged = vi.fn();
  const { result } = renderHook(() =>
    useAssetFilters(assets, initialParams, setSearchParams, onFiltersChanged)
  );
  return { result, setSearchParams, onFiltersChanged };
}

const ids = (assets: Asset[]) => assets.map(a => a.id);

describe('useAssetFilters.filteredAssets', () => {
  it('returns every asset when no filters are applied', () => {
    const { result } = setup(ASSETS);
    expect(ids(result.current.filteredAssets)).toEqual(['1', '2', '3']);
  });

  it('filters by subsidiary (multi-select, OR within dimension)', () => {
    const { result } = setup(ASSETS);
    act(() => result.current.setFilterSubsidiary(['Alpha']));
    expect(ids(result.current.filteredAssets)).toEqual(['1', '3']);
  });

  it('filters by asset class (categorySegment1)', () => {
    const { result } = setup(ASSETS);
    act(() => result.current.setFilterCategory(['Furniture']));
    expect(ids(result.current.filteredAssets)).toEqual(['2']);
  });

  it('filters by location (categorySegment2)', () => {
    const { result } = setup(ASSETS);
    act(() => result.current.setFilterLocation(['Branch']));
    expect(ids(result.current.filteredAssets)).toEqual(['2', '3']);
  });

  it('filters by status', () => {
    const { result } = setup(ASSETS);
    act(() => result.current.setFilterStatus(['Broken']));
    expect(ids(result.current.filteredAssets)).toEqual(['3']);
  });

  it('filters by verification (Yes/No derived from boolean)', () => {
    const { result } = setup(ASSETS);
    act(() => result.current.setFilterVerification(['No']));
    expect(ids(result.current.filteredAssets)).toEqual(['2']);
  });

  it('filters by date range on datePlaceInService (inclusive bounds)', () => {
    const { result } = setup(ASSETS);
    act(() => {
      result.current.setDateFrom('2024-01-01');
      result.current.setDateTo('2024-12-31');
    });
    expect(ids(result.current.filteredAssets)).toEqual(['1', '2']);
  });

  it('filters by cost range, parsing currency-formatted strings', () => {
    const { result } = setup(ASSETS);
    act(() => {
      result.current.setCostMin('600');
      result.current.setCostMax('2000');
    });
    expect(ids(result.current.filteredAssets)).toEqual(['1']);
  });

  it('matches search query against description or asset number, case-insensitively', () => {
    // q is read into both searchQuery and debouncedSearchQuery at mount, sidestepping the 300ms debounce.
    const { result } = setup(ASSETS, 'q=dell');
    expect(ids(result.current.filteredAssets)).toEqual(['1']);
  });

  it('matches search query against asset number', () => {
    const { result } = setup(ASSETS, 'q=AN-003');
    expect(ids(result.current.filteredAssets)).toEqual(['3']);
  });

  it('combines multiple filter dimensions with AND', () => {
    const { result } = setup(ASSETS);
    act(() => {
      result.current.setFilterSubsidiary(['Alpha']);
      result.current.setFilterStatus(['Active']);
    });
    expect(ids(result.current.filteredAssets)).toEqual(['1']);
  });

  it('clearFilters resets every dimension back to showing all assets', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup(ASSETS, 'q=dell');
      act(() => {
        result.current.setFilterSubsidiary(['Alpha']);
        result.current.setFilterStatus(['Broken']);
      });
      expect(ids(result.current.filteredAssets)).toEqual([]);
      act(() => result.current.clearFilters());
      // clearFilters resets searchQuery immediately, but filteredAssets reads the
      // debounced value, which only catches up 300ms later via the debounce effect.
      expect(ids(result.current.filteredAssets)).toEqual(['1']);
      act(() => vi.advanceTimersByTime(300));
      expect(ids(result.current.filteredAssets)).toEqual(['1', '2', '3']);
    } finally {
      vi.useRealTimers();
    }
  });
});

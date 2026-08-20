import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useMaintenanceFilters } from './useMaintenanceFilters';
import type { MaintenanceRecord } from '../types/maintenance';

function makeRecord(overrides: Partial<MaintenanceRecord>): MaintenanceRecord {
  return {
    id: 'base',
    assetBook: 'Book A',
    subsidiary: 'Alpha',
    assetNumber: 'AN-000',
    assetDescription: 'Generic Record',
    assetUnits: '1',
    serviceType: 'Preventive',
    assetCategorySegment1: 'IT Equipment',
    assetCategorySegment2: 'HQ',
    estimateCost: '100',
    actualCost: '100',
    status: 'Pending',
    scheduledDate: '2024-01-01',
    ...overrides,
  };
}

const RECORDS: MaintenanceRecord[] = [
  makeRecord({ id: '1', subsidiary: 'Alpha', assetBook: 'Book A', status: 'Pending', assetDescription: 'AC Unit', assetNumber: 'AN-001' }),
  makeRecord({ id: '2', subsidiary: 'Beta', assetBook: 'Book B', status: 'Completed', assetDescription: 'Generator', assetNumber: 'AN-002' }),
  makeRecord({ id: '3', subsidiary: 'Alpha', assetBook: 'Book B', status: 'Overdue', assetDescription: 'Elevator', assetNumber: 'AN-003' }),
];

function setup(initialQuery = '') {
  const initialParams = new URLSearchParams(initialQuery);
  const setSearchParams = vi.fn() as unknown as SetURLSearchParams;
  const onFiltersChanged = vi.fn();
  const { result } = renderHook(() =>
    useMaintenanceFilters(RECORDS, initialParams, setSearchParams, onFiltersChanged)
  );
  return { result, setSearchParams, onFiltersChanged };
}

const ids = (records: MaintenanceRecord[]) => records.map((r) => r.id);

describe('useMaintenanceFilters', () => {
  it('returns every record when no filters are applied', () => {
    const { result } = setup();
    expect(ids(result.current.filteredRecords)).toEqual(['1', '2', '3']);
  });

  it('supports multi-select on subsidiary (feature upgrade from single "" sentinel)', () => {
    const { result } = setup();
    act(() => result.current.setFilterSubsidiary(['Alpha']));
    expect(ids(result.current.filteredRecords)).toEqual(['1', '3']);
  });

  it('supports selecting multiple statuses at once', () => {
    const { result } = setup();
    act(() => result.current.setFilterStatus(['Pending', 'Overdue']));
    expect(ids(result.current.filteredRecords)).toEqual(['1', '3']);
  });

  it('filters by asset book', () => {
    const { result } = setup();
    act(() => result.current.setFilterAssetBook(['Book B']));
    expect(ids(result.current.filteredRecords)).toEqual(['2', '3']);
  });

  it('matches search query against description or asset number', () => {
    const { result } = setup('q=elevator');
    expect(ids(result.current.filteredRecords)).toEqual(['3']);
  });

  it('combines dimensions with AND', () => {
    const { result } = setup();
    act(() => {
      result.current.setFilterSubsidiary(['Alpha']);
      result.current.setFilterStatus(['Overdue']);
    });
    expect(ids(result.current.filteredRecords)).toEqual(['3']);
  });

  it('persists filters to the URL (new: previously had no URL sync at all)', () => {
    const { result, setSearchParams } = setup();
    act(() => result.current.setFilterSubsidiary(['Alpha']));
    const lastCall = (setSearchParams as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const params = lastCall![0] as URLSearchParams;
    expect(params.get('subsidiary')).toBe('Alpha');
  });

  it('restores filter state from a saved URL', () => {
    const { result } = setup('subsidiary=Alpha%2CBeta&status=Overdue');
    expect(result.current.filterSubsidiary).toEqual(['Alpha', 'Beta']);
    expect(result.current.filterStatus).toEqual(['Overdue']);
  });

  it('produces removable chips (new: previously had no chips at all)', () => {
    const { result } = setup();
    act(() => result.current.setFilterSubsidiary(['Alpha']));
    expect(result.current.activeFilters).toHaveLength(1);
    expect(result.current.activeFilters[0].label).toBe('Subsidiary: Alpha');
    act(() => result.current.activeFilters[0].onRemove());
    expect(result.current.filterSubsidiary).toEqual([]);
  });

  it('clearFilters resets every dimension and the search query', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup('q=elevator');
      act(() => {
        result.current.setFilterSubsidiary(['Beta']);
        result.current.setFilterStatus(['Completed']);
      });
      expect(ids(result.current.filteredRecords)).toEqual([]);
      act(() => result.current.clearFilters());
      act(() => vi.advanceTimersByTime(300));
      expect(ids(result.current.filteredRecords)).toEqual(['1', '2', '3']);
    } finally {
      vi.useRealTimers();
    }
  });
});

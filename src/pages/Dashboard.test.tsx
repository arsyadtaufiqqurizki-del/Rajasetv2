import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { Asset } from '../contexts/AssetContext';

const mockUseAsset = vi.fn();
vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => mockUseAsset(),
}));

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    id: overrides.id ?? 'base',
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

function renderDashboard(assets: Asset[]) {
  mockUseAsset.mockReturnValue({
    assets,
    subsidiaries: [],
    categories1: [],
    categories2: [],
    lastFetchedAt: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard MoM delta (calculateChange)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a normal percentage increase when both months have data', () => {
    const assets = [
      makeAsset({ id: '1', createdAt: '2024-03-05T00:00:00.000Z' }),
      makeAsset({ id: '2', createdAt: '2024-03-10T00:00:00.000Z' }),
      makeAsset({ id: '3', createdAt: '2024-02-20T00:00:00.000Z' }),
    ];
    renderDashboard(assets);
    // 2 this month vs 1 last month => (2-1)/1 * 100 = 100.0%
    expect(screen.getAllByText('100.0%').length).toBeGreaterThan(0);
  });

  it('shows "No data for last month" instead of a misleading 100% when the previous month was zero', () => {
    const assets = [
      makeAsset({ id: '1', createdAt: '2024-03-01T00:00:00.000Z' }),
      makeAsset({ id: '2', createdAt: '2024-03-02T00:00:00.000Z' }),
      makeAsset({ id: '3', createdAt: '2024-03-03T00:00:00.000Z' }),
      makeAsset({ id: '4', createdAt: '2024-03-04T00:00:00.000Z' }),
      makeAsset({ id: '5', createdAt: '2024-03-05T00:00:00.000Z' }),
    ];
    renderDashboard(assets);
    // 5 this month vs 0 last month: no baseline to compare against, so no percentage is claimed.
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('500.0%')).not.toBeInTheDocument();
    expect(screen.getAllByText('No data for last month').length).toBeGreaterThan(0);
  });

  it('shows "No data for last month" (not a false "no change") when both months are zero', () => {
    const assets = [
      makeAsset({ id: '1', createdAt: '2024-01-01T00:00:00.000Z' }),
    ];
    renderDashboard(assets);
    const noDataLabels = screen.getAllByText('No data for last month');
    expect(noDataLabels.length).toBeGreaterThan(0);
  });
});

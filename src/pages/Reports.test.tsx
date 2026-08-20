import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as XLSX from 'xlsx';
import Reports from './Reports';
import type { Asset } from '../contexts/AssetContext';

// Depreciation math (Reports.tsx:99-110) is trapped inside generatePreview and never
// rendered as text — it only reaches the outside world via the PDF/XLSX export payload.
// We drive the real component through Report Type -> date range -> Generate Preview ->
// Export to Excel, and inspect exactly what XLSX.utils.json_to_sheet was called with.
// This pins the current NBV-per-quarter formula ahead of extracting it in Step 9.

const mockUseAsset = vi.fn();
const mockUseMaintenance = vi.fn();
const mockUseReport = vi.fn();

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => mockUseAsset(),
}));
vi.mock('../contexts/MaintenanceContext', () => ({
  useMaintenance: () => mockUseMaintenance(),
}));
vi.mock('../contexts/ReportContext', () => ({
  useReport: () => mockUseReport(),
}));
vi.mock('../lib/activityLogger', () => ({
  logActivity: vi.fn(),
}));
vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');
  return { ...actual, writeFile: vi.fn() };
});

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    id: overrides.id ?? 'base',
    assetBook: 'Book A',
    subsidiary: 'Alpha',
    assetNumber: 'AN-000',
    assetDescription: 'Generic Asset',
    assetCost: '1000',
    datePlaceInService: '2023-01-01',
    assetUnits: '1',
    categorySegment1: 'IT Equipment',
    categorySegment2: 'HQ',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '36',
    listed: 'Yes',
    status: 'Active',
    statusLevel: 'success',
    verification: true,
    verificationDate: '2023-01-01',
    itemStatus: 'In Use',
    createdAt: '2023-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Reports > Depreciation Schedule NBV per quarter', () => {
  it('computes straight-line remaining value per quarter for a mix of assets', async () => {
    // A: cost 12000, life 12mo, placed 2023-01-01 -> ages into depreciation within range.
    // B: cost 6000, life 24mo, placed 2023-07-01 -> placed *after* both quarter-end dates,
    //    so monthsBetween(from, to<=from) returns 0 and it is (currently) valued at full cost.
    // C: cost 3000, lifeInMonths '0' -> parseInt('0') || 60 falls back to 60mo (falsy-zero bug),
    //    placed 2020-01-01 so it's well into its (wrongly-defaulted) 60-month life.
    const assets = [
      makeAsset({ id: 'A', assetCost: '12000', lifeInMonths: '12', datePlaceInService: '2023-01-01' }),
      makeAsset({ id: 'B', assetCost: '6000', lifeInMonths: '24', datePlaceInService: '2023-07-01' }),
      makeAsset({ id: 'C', assetCost: '3000', lifeInMonths: '0', datePlaceInService: '2020-01-01' }),
    ];
    mockUseAsset.mockReturnValue({ assets, subsidiaries: [] });
    mockUseMaintenance.mockReturnValue({ records: [] });
    mockUseReport.mockReturnValue({
      reportHistory: [], page: 1, totalPages: 1, totalCount: 0,
      setPage: vi.fn(), saveReport: vi.fn(), deleteReport: vi.fn(),
    });

    const jsonToSheetSpy = vi.spyOn(XLSX.utils, 'json_to_sheet');

    render(<Reports />);

    fireEvent.change(screen.getByDisplayValue('Asset Valuation Summary'), {
      target: { value: 'Depreciation Schedule' },
    });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2023-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2023-06-30' } });

    fireEvent.click(screen.getByRole('button', { name: /generate preview/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export to excel/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /export to excel/i }));

    expect(jsonToSheetSpy).toHaveBeenCalledTimes(1);
    const rows = jsonToSheetSpy.mock.calls[0][0] as { name: string; value: number }[];

    expect(rows.map(r => r.name)).toEqual(['Q1 2023', 'Q2 2023']);
    expect(rows[0].value).toBeCloseTo(10000 + 6000 + 1100, 6); // Q1 2023 (ends 2023-03-31)
    expect(rows[1].value).toBeCloseTo(7000 + 6000 + 950, 6);   // Q2 2023 (ends 2023-06-30)
  });
});

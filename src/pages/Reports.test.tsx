import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
const mockUseAuth = vi.fn();

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => mockUseAsset(),
}));
vi.mock('../contexts/MaintenanceContext', () => ({
  useMaintenance: () => mockUseMaintenance(),
}));
vi.mock('../contexts/ReportContext', () => ({
  useReport: () => mockUseReport(),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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
    listed: 'Audited',
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
    //    so monthsBetween(from, to<=from) returns 0 and it is valued at full cost.
    // C: cost 3000, lifeInMonths '0' -> treated as non-depreciable (computeBookValue), so it
    //    stays at full cost regardless of placement date.
    const assets = [
      makeAsset({ id: 'A', assetCost: '12000', lifeInMonths: '12', datePlaceInService: '2023-01-01' }),
      makeAsset({ id: 'B', assetCost: '6000', lifeInMonths: '24', datePlaceInService: '2023-07-01' }),
      makeAsset({ id: 'C', assetCost: '3000', lifeInMonths: '0', datePlaceInService: '2020-01-01' }),
    ];
    mockUseAsset.mockReturnValue({ assets, subsidiaries: [], categories1: [], categories2: [] });
    mockUseMaintenance.mockReturnValue({ records: [] });
    mockUseReport.mockReturnValue({
      reportHistory: [], loading: false, error: null, page: 1, totalPages: 1, totalCount: 0,
      setPage: vi.fn(), saveReport: vi.fn(), deleteReport: vi.fn(),
    });
    mockUseAuth.mockReturnValue({ userName: 'Test User' });

    // Excel now writes two sheets (Summary + Detail); the chart's aggregate rows — the
    // ones carrying the NBV-per-quarter formula under test — land in Summary via
    // sheet_add_json, appended after the summary block.
    const sheetAddJsonSpy = vi.spyOn(XLSX.utils, 'sheet_add_json');

    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByDisplayValue('Asset Valuation Summary'), {
      target: { value: 'Depreciation Schedule' },
    });

    // Date pickers are collapsed under a period preset dropdown; switch to Custom to reveal them.
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'custom' } });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2023-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2023-06-30' } });

    fireEvent.click(screen.getByRole('button', { name: /^review$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export to excel/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /export to excel/i }));

    // exportReportXlsx dynamic-imports 'xlsx', so the call is now async.
    await waitFor(() => {
      expect(sheetAddJsonSpy).toHaveBeenCalledTimes(1);
    });
    const rows = sheetAddJsonSpy.mock.calls[0][1] as { name: string; value: number }[];

    expect(rows.map(r => r.name)).toEqual(['Q1 2023', 'Q2 2023']);
    expect(rows[0].value).toBeCloseTo(10000 + 6000 + 3000, 6); // Q1 2023 (ends 2023-03-31)
    expect(rows[1].value).toBeCloseTo(7000 + 6000 + 3000, 6);  // Q2 2023 (ends 2023-06-30)
  });
});

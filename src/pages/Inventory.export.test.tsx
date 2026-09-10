import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Inventory from './Inventory';
import type { Asset } from '../types/asset';

// Golden-file test — Step 0 of "refactoring v2.md". Step 2 moves the CSV export
// column mapping out of Inventory.tsx into lib/assetCsv.ts (buildExportRows). The gate
// for that step is "golden file identik", so this records today's exact CSV bytes:
// header order, value formatting, quoting, sanitizeCell's formula-injection guard,
// and the line endings Papa.unparse produces.
//
// To re-record after a DELIBERATE format change:
//   UPDATE_GOLDEN=1 npx vitest run src/pages/Inventory.export.test.tsx
// and review the diff in the fixture before committing it.

const GOLDEN_PATH = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'asset-export.golden.csv');

const capturedDownloads: { filename: string; blob: Blob }[] = [];

vi.mock('../lib/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/csv')>();
  return {
    ...actual, // sanitizeCell + toCsvBlob stay real — they are part of what is pinned
    downloadBlob: (filename: string, blob: Blob) => {
      capturedDownloads.push({ filename, blob });
    },
  };
});

vi.mock('../lib/activityLogger', () => ({ logActivity: vi.fn() }));

let assets: Asset[] = [];

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({
    assets,
    loading: false,
    error: null,
    refetch: vi.fn(),
    deleteAsset: vi.fn(),
    deleteMultipleAssets: vi.fn(),
    deleteAllAssets: vi.fn(),
    bulkUpdateAssets: vi.fn(),
    setEditingAsset: vi.fn(),
    setIsEditModalOpen: vi.fn(),
    setIsAddModalOpen: vi.fn(),
    subsidiaries: [],
    categories1: [],
    categories2: [],
    itemStatuses: [],
    addAsset: vi.fn(),
  }),
}));

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    id: 'a-0',
    assetBook: 'Corporate',
    subsidiary: 'PT Raja Prima',
    assetNumber: 'AN-000',
    assetDescription: 'Generic Asset',
    assetCost: '1000',
    datePlaceInService: '2024-01-01',
    assetUnits: '1',
    categorySegment1: 'IT Equipment',
    categorySegment2: 'HQ',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '36',
    listed: 'Audited',
    status: 'Active',
    statusLevel: 'success',
    verification: true,
    verificationDate: '2024-06-01',
    itemStatus: 'Asset',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Deliberately awkward rows: separators, quotes, formula injection, unlimited life, blanks. */
const EXPORT_FIXTURE: Asset[] = [
  makeAsset({ id: 'a-1', assetNumber: 'AN-001', assetCost: '2499.00' }),
  makeAsset({
    id: 'a-2',
    assetNumber: 'AN-002',
    assetDescription: 'Server, rack "A"',
    assetCost: '150000.55',
    depreciationMethod: 'Declining Balance',
    lifeInMonths: '60',
    datePlaceInService: '2023-03-15',
  }),
  makeAsset({
    id: 'a-3',
    assetNumber: 'AN-003',
    assetDescription: '=SUM(A1:A2)', // sanitizeCell must prefix this with a quote
    categorySegment2: '-Basement',
    assetCost: '0',
    verification: false,
    verificationDate: '',
    listed: 'Non-Listed',
    status: 'Retired',
  }),
  makeAsset({
    id: 'a-4',
    assetNumber: 'AN-004',
    assetDescription: 'Land parcel',
    lifeInMonths: 'Unlimited',
    assetCost: '5000000',
    itemStatus: '',
    subsidiary: '',
  }),
  makeAsset({
    id: 'a-5',
    assetNumber: 'AN-005',
    assetDescription: 'Fully depreciated rig',
    assetCost: '12000',
    lifeInMonths: '12',
    datePlaceInService: '2020-01-01',
    assetUnits: '3',
  }),
];

beforeEach(() => {
  capturedDownloads.length = 0;
  assets = EXPORT_FIXTURE;
  // Book Value is computed against startOfToday(), so the clock has to be pinned
  // for the golden bytes to be reproducible.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T03:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

async function exportAllColumns(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Data/ }));
  await user.click(screen.getByRole('menuitemcheckbox', { name: /Export all columns/ }));
  await user.click(screen.getByRole('menuitem', { name: /Export All \(Filtered\)/ }));
  await waitFor(() => expect(capturedDownloads).toHaveLength(1));
  return capturedDownloads[0];
}

describe('Inventory CSV export — golden file', () => {
  it('produces byte-identical CSV for the fixture', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    const { filename, blob } = await exportAllColumns(user);
    const actual = await blob.text();

    expect(filename).toBe('Asset_Inventory_2026-09-10.csv');

    if (process.env.UPDATE_GOLDEN) {
      writeFileSync(GOLDEN_PATH, actual, 'utf8');
    }

    expect(actual).toBe(readFileSync(GOLDEN_PATH, 'utf8'));
  });

  it('exports only the selected rows, with the same columns, under a Selected_ filename', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    // [0] is the select-all header checkbox; [1] is the first data row.
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole('button', { name: /Data/ }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Export all columns/ }));
    await user.click(screen.getByRole('menuitem', { name: /Export Selected/ }));
    await waitFor(() => expect(capturedDownloads).toHaveLength(1));

    const { filename, blob } = capturedDownloads[0];
    const text = await blob.text();
    const golden = readFileSync(GOLDEN_PATH, 'utf8').split('\r\n');

    expect(filename).toBe('Asset_Inventory_Selected_2026-09-10.csv');
    expect(text.split('\r\n')).toEqual([golden[0], golden[1]]); // header + first row only
  });

  it('exports nothing when the filtered set is empty', async () => {
    const user = userEvent.setup();
    assets = [];
    render(
      <MemoryRouter>
        <Inventory />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Data/ }));
    await user.click(screen.getByRole('menuitem', { name: /Export All \(Filtered\)/ }));

    expect(capturedDownloads).toHaveLength(0);
  });
});

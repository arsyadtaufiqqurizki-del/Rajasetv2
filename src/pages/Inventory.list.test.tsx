import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Inventory from './Inventory';
import type { Asset } from '../types/asset';

// Characterization tests — Step 8 pra-kerja of "refactoring v2.md". Inventory.tsx has
// no coverage for its selection / pagination / bulk-delete blocks, yet Step 8 replaces
// them with shared hooks (useRowSelection, usePagination, useBulkDelete). The riskiest
// parts are pinned here before touching production code:
// - the `noFilters && allSelected` branch that decides deleteAll vs deleteMultiple,
// - the localStorage-persisted page size (10/25/50/100).

const mockDeleteAsset = vi.fn();
const mockDeleteMultiple = vi.fn();
const mockDeleteAll = vi.fn();

let assets: Asset[] = [];

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({
    assets,
    loading: false,
    error: null,
    refetch: vi.fn(),
    deleteAsset: mockDeleteAsset,
    deleteMultipleAssets: mockDeleteMultiple,
    deleteAllAssets: mockDeleteAll,
    bulkUpdateAssets: vi.fn(),
    setEditingAsset: vi.fn(),
    setIsEditModalOpen: vi.fn(),
    setIsAddModalOpen: vi.fn(),
    subsidiaries: ['PT A', 'PT B'],
    categories1: ['Electronics'],
    categories2: ['HQ'],
    itemStatuses: ['Asset'],
    addAsset: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('../lib/activityLogger', () => ({
  logActivity: vi.fn(),
}));

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'a-1',
    assetBook: 'Corporate',
    subsidiary: 'PT A',
    assetNumber: 'AN-001',
    assetDescription: 'Laptop',
    assetCost: '1,000',
    datePlaceInService: '2026-01-15',
    assetUnits: '1',
    categorySegment1: 'Electronics',
    categorySegment2: 'HQ',
    depreciationMethod: 'Straight-Line',
    lifeInMonths: '36',
    listed: 'Listed',
    status: 'Active',
    statusLevel: 'success',
    verification: true,
    verificationDate: '2026-02-01',
    itemStatus: 'Asset',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** 12 rows, so the default page size of 10 produces two pages. */
function makeAssets(count: number): Asset[] {
  return Array.from({ length: count }, (_, i) =>
    makeAsset({
      id: `a-${i + 1}`,
      assetNumber: `AN-${String(i + 1).padStart(3, '0')}`,
      assetDescription: `Asset ${i + 1}`,
      subsidiary: i < 10 ? 'PT A' : 'PT B',
    })
  );
}

function renderPage(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Inventory />
    </MemoryRouter>
  );
}

function tableCheckboxes(): HTMLInputElement[] {
  const table = screen.getByRole('table');
  return within(table).getAllByRole('checkbox') as HTMLInputElement[];
}

/** Drives the "type DELETE then confirm" gate of the bulk DeleteConfirmModal. */
async function confirmBulkDelete(user: ReturnType<typeof userEvent.setup>, text = 'DELETE') {
  const input = await screen.findByPlaceholderText('Type DELETE to confirm');
  if (text) fireEvent.change(input, { target: { value: text } });
  await user.click(screen.getByRole('button', { name: 'Yes, Delete All' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  assets = makeAssets(12);
  mockDeleteMultiple.mockResolvedValue(undefined);
  mockDeleteAll.mockResolvedValue(undefined);
  mockDeleteAsset.mockResolvedValue(undefined);
});

describe('Inventory — pagination', () => {
  it('shows 10 rows on page 1 and the remainder on page 2', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Showing 1–10 of 12 assets')).toBeInTheDocument();
    expect(screen.getByText('Asset 1')).toBeInTheDocument();
    expect(screen.queryByText('Asset 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('Showing 11–12 of 12 assets')).toBeInTheDocument();
    expect(screen.getByText('Asset 11')).toBeInTheDocument();
    expect(screen.queryByText('Asset 1')).not.toBeInTheDocument();
  });
});

describe('Inventory — row selection', () => {
  it('select-all covers every filtered row, not just the visible page', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(tableCheckboxes()[0]);

    expect(screen.getByText(/assets selected/)).toHaveTextContent('12');
  });

  it('toggles a single row and clears the bulk bar at zero', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByRole('button', { name: 'Delete Selected' })).not.toBeInTheDocument();

    await user.click(tableCheckboxes()[1]);
    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeInTheDocument();

    await user.click(tableCheckboxes()[1]);
    expect(screen.queryByRole('button', { name: 'Delete Selected' })).not.toBeInTheDocument();
  });
});

describe('Inventory — bulk delete routing (deleteAll vs deleteMultiple)', () => {
  it('takes the deleteAll path only when nothing is filtered and everything is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(tableCheckboxes()[0]);
    await user.click(screen.getByRole('button', { name: 'Delete Selected' }));
    await confirmBulkDelete(user);

    await waitFor(() => expect(mockDeleteAll).toHaveBeenCalledTimes(1));
    expect(mockDeleteMultiple).not.toHaveBeenCalled();
    expect(mockDeleteAll.mock.calls[0][0]).toBeTypeOf('function'); // onProgress callback
  });

  it('takes the deleteMultiple path when a filter is active, even with all rows selected', async () => {
    const user = userEvent.setup();
    renderPage('/?subsidiary=PT+B');

    await user.click(tableCheckboxes()[0]);
    await user.click(screen.getByRole('button', { name: 'Delete Selected' }));
    await confirmBulkDelete(user);

    await waitFor(() => expect(mockDeleteMultiple).toHaveBeenCalledTimes(1));
    expect(mockDeleteAll).not.toHaveBeenCalled();
    expect(mockDeleteMultiple.mock.calls[0][0]).toEqual(['a-11', 'a-12']);
  });

  it('deletes nothing until the confirmation text is exactly DELETE', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(tableCheckboxes()[1]);
    await user.click(screen.getByRole('button', { name: 'Delete Selected' }));

    const confirmButton = screen.getByRole('button', { name: 'Yes, Delete All' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Type DELETE to confirm'), { target: { value: 'delete' } });
    expect(confirmButton).toBeDisabled();

    expect(mockDeleteMultiple).not.toHaveBeenCalled();
    expect(mockDeleteAll).not.toHaveBeenCalled();
  });
});

describe('Inventory — persisted page size', () => {
  it('persists a changed page size to localStorage', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox'), '25');

    expect(localStorage.getItem('rajaset:inventory:pageSize')).toBe('25');
    expect(screen.getByText('Showing 1–12 of 12 assets')).toBeInTheDocument();
  });

  it('restores the persisted page size on mount', () => {
    localStorage.setItem('rajaset:inventory:pageSize', '50');
    renderPage();

    expect(screen.getByText('Showing 1–12 of 12 assets')).toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('50');
  });
});

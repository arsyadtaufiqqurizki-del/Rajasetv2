import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Reclassification from './Reclassification';
import type { Reclassification as ReclassificationRow } from '../types/reclassification';

// Characterization tests — Step 0 of "refactoring v2.md". Reclassification.tsx has no
// coverage today, yet Step 8 replaces its selection / pagination / bulk-delete blocks
// with shared hooks (useRowSelection, usePagination, useBulkDelete). The riskiest part
// is the `noFilters && allSelected` branch that decides deleteAll vs deleteMultiple —
// every arm of it is pinned below, including the orphan-delete path that must never
// take the deleteAll route (see the comment at Reclassification.tsx:190).

const mockDeleteReclassification = vi.fn();
const mockDeleteMultiple = vi.fn();
const mockDeleteAll = vi.fn();
const mockSyncFromAssets = vi.fn();
const mockSetEditing = vi.fn();
const mockSetIsEditModalOpen = vi.fn();
const mockSetVerifying = vi.fn();
const mockSetIsVerifyModalOpen = vi.fn();
const mockSetIsAddModalOpen = vi.fn();

let rows: ReclassificationRow[] = [];

vi.mock('../contexts/ReclassificationContext', () => ({
  useReclassification: () => ({
    reclassifications: rows,
    deleteReclassification: mockDeleteReclassification,
    deleteMultipleReclassifications: mockDeleteMultiple,
    deleteAllReclassifications: mockDeleteAll,
    setEditingReclassification: mockSetEditing,
    setIsEditModalOpen: mockSetIsEditModalOpen,
    setVerifyingReclassification: mockSetVerifying,
    setIsVerifyModalOpen: mockSetIsVerifyModalOpen,
    setIsAddModalOpen: mockSetIsAddModalOpen,
    syncFromAssets: mockSyncFromAssets,
  }),
}));

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({ assets: [], itemStatuses: ['Asset', 'Inventory', 'Needs Review'] }),
}));

function makeRow(overrides: Partial<ReclassificationRow> = {}): ReclassificationRow {
  return {
    id: 'r-1',
    assetId: 'a-1',
    linkedAssetNumber: 'AN-001',
    assetCategory: 'Electronics',
    assetDescription: 'Laptop',
    location: 'HQ',
    unit: '1',
    ownership: 'Owned',
    category: 'Asset',
    remarks: '',
    assetDeletedAt: null,
    verified: false,
    verificationDate: '',
    verifiedBy: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** 12 rows, so the hard-coded itemsPerPage = 10 produces two pages. */
function makeRows(count: number): ReclassificationRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeRow({
      id: `r-${i + 1}`,
      assetDescription: `Item ${i + 1}`,
      category: i % 2 === 0 ? 'Asset' : 'Inventory',
    })
  );
}

function renderPage(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Reclassification />
    </MemoryRouter>
  );
}

function rowCheckboxes(): HTMLInputElement[] {
  // [0] is the table's select-all header checkbox; the rest are one per visible row.
  const table = screen.getByRole('table');
  return within(table).getAllByRole('checkbox') as HTMLInputElement[];
}

/** Drives the "type DELETE then confirm" gate of whichever DeleteConfirmModal is open. */
async function confirmBulkDelete(user: ReturnType<typeof userEvent.setup>, text = 'DELETE') {
  const input = await screen.findByPlaceholderText('Type DELETE to confirm');
  if (text) fireEvent.change(input, { target: { value: text } });
  await user.click(screen.getByRole('button', { name: 'Yes, Delete All' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = makeRows(12);
  mockDeleteMultiple.mockResolvedValue(undefined);
  mockDeleteAll.mockResolvedValue(undefined);
  mockDeleteReclassification.mockResolvedValue(undefined);
});

describe('Reclassification — pagination', () => {
  it('shows 10 rows on page 1 and the remainder on page 2', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Showing 10 of 12 entries')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous page' })); // disabled on page 1
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 12 entries')).toBeInTheDocument();
    expect(screen.getByText('Item 11')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('reports a single page when a URL filter narrows the list', () => {
    renderPage('/?category=Inventory');

    expect(screen.getByText('Showing 6 of 6 entries')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });
});

describe('Reclassification — row selection', () => {
  it('select-all covers every filtered row, not just the visible page', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowCheckboxes()[0]);

    // 12 selected even though only 10 rows are rendered.
    expect(screen.getByRole('button', { name: /Delete Selected \(12\)/ })).toBeInTheDocument();
    expect(rowCheckboxes().every((cb) => cb.checked)).toBe(true);
  });

  it('select-all respects the active filter', async () => {
    const user = userEvent.setup();
    renderPage('/?category=Inventory');

    await user.click(rowCheckboxes()[0]);

    expect(screen.getByRole('button', { name: /Delete Selected \(6\)/ })).toBeInTheDocument();
  });

  it('toggles a single row on and off, and hides the bulk button at zero', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByRole('button', { name: /Delete Selected/ })).not.toBeInTheDocument();

    await user.click(rowCheckboxes()[1]);
    expect(screen.getByRole('button', { name: /Delete Selected \(1\)/ })).toBeInTheDocument();

    await user.click(rowCheckboxes()[2]);
    expect(screen.getByRole('button', { name: /Delete Selected \(2\)/ })).toBeInTheDocument();

    await user.click(rowCheckboxes()[1]);
    await user.click(rowCheckboxes()[2]);
    expect(screen.queryByRole('button', { name: /Delete Selected/ })).not.toBeInTheDocument();
  });

  it('unchecking select-all clears the whole selection', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowCheckboxes()[0]);
    await user.click(rowCheckboxes()[0]);

    expect(screen.queryByRole('button', { name: /Delete Selected/ })).not.toBeInTheDocument();
  });
});

describe('Reclassification — bulk delete routing (deleteAll vs deleteMultiple)', () => {
  it('takes the deleteAll path only when nothing is filtered and everything is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowCheckboxes()[0]);
    await user.click(screen.getByRole('button', { name: /Delete Selected \(12\)/ }));
    await confirmBulkDelete(user);

    await waitFor(() => expect(mockDeleteAll).toHaveBeenCalledTimes(1));
    expect(mockDeleteMultiple).not.toHaveBeenCalled();
    expect(mockDeleteAll.mock.calls[0][0]).toBeTypeOf('function'); // onProgress callback
  });

  it('takes the deleteMultiple path when a filter is active, even with all rows selected', async () => {
    const user = userEvent.setup();
    renderPage('/?category=Inventory');

    await user.click(rowCheckboxes()[0]);
    await user.click(screen.getByRole('button', { name: /Delete Selected \(6\)/ }));
    await confirmBulkDelete(user);

    await waitFor(() => expect(mockDeleteMultiple).toHaveBeenCalledTimes(1));
    expect(mockDeleteAll).not.toHaveBeenCalled();
    expect(mockDeleteMultiple.mock.calls[0][0]).toHaveLength(6);
  });

  it('takes the deleteMultiple path when a search query is active', async () => {
    const user = userEvent.setup();
    renderPage('/?q=Item%201');

    await user.click(rowCheckboxes()[0]);
    await user.click(screen.getByRole('button', { name: /Delete Selected/ }));
    await confirmBulkDelete(user);

    await waitFor(() => expect(mockDeleteMultiple).toHaveBeenCalledTimes(1));
    expect(mockDeleteAll).not.toHaveBeenCalled();
  });

  it('takes the deleteMultiple path for a partial selection with no filters', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowCheckboxes()[1]);
    await user.click(rowCheckboxes()[3]);
    await user.click(screen.getByRole('button', { name: /Delete Selected \(2\)/ }));
    await confirmBulkDelete(user);

    await waitFor(() => expect(mockDeleteMultiple).toHaveBeenCalledTimes(1));
    expect(mockDeleteAll).not.toHaveBeenCalled();
    expect(mockDeleteMultiple.mock.calls[0][0]).toEqual(['r-1', 'r-3']);
  });

  it('deletes nothing until the confirmation text is exactly DELETE', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowCheckboxes()[1]);
    await user.click(screen.getByRole('button', { name: /Delete Selected \(1\)/ }));

    const confirmButton = screen.getByRole('button', { name: 'Yes, Delete All' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Type DELETE to confirm'), { target: { value: 'delete' } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    expect(confirmButton).toBeEnabled();

    expect(mockDeleteMultiple).not.toHaveBeenCalled();
    expect(mockDeleteAll).not.toHaveBeenCalled();
  });

  it('clears the selection and reports completion once the delete resolves', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(rowCheckboxes()[1]);
    await user.click(screen.getByRole('button', { name: /Delete Selected \(1\)/ }));
    await confirmBulkDelete(user);

    expect(await screen.findByText('Delete Complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Selected/ })).not.toBeInTheDocument();
  });
});

describe('Reclassification — orphan (deleted-asset) rows', () => {
  beforeEach(() => {
    rows = [
      makeRow({ id: 'r-1', assetDescription: 'Live Item' }),
      makeRow({ id: 'r-2', assetDescription: 'Orphan Item', assetDeletedAt: '2026-08-01T00:00:00.000Z' }),
    ];
    mockSyncFromAssets.mockResolvedValue({ total: 0, success: 0, failed: 0, errors: [] });
  });

  it('never routes the orphan delete through deleteAll, even when the counts would match', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Sync from Assets/ }));
    expect(await screen.findByText('Sync Complete')).toBeInTheDocument();
    expect(screen.getByText('1 asset telah dihapus dari Asset Inventory')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hapus baris ini' }));
    await confirmBulkDelete(user);

    await waitFor(() => expect(mockDeleteMultiple).toHaveBeenCalledTimes(1));
    expect(mockDeleteMultiple.mock.calls[0][0]).toEqual(['r-2']);
    expect(mockDeleteAll).not.toHaveBeenCalled();
  });
});

describe('Reclassification — single-row actions', () => {
  beforeEach(() => {
    rows = [makeRow({ id: 'r-1', assetDescription: 'Laptop' })];
  });

  it('asks for confirmation before deleting one row, using the Indonesian copy', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete Item' }));

    expect(screen.getByRole('heading', { name: 'Hapus Item Reclassification' })).toBeInTheDocument();
    expect(screen.getByText('Yakin ingin menghapus item reclassification ini?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hapus' }));

    expect(mockDeleteReclassification).toHaveBeenCalledWith('r-1');
  });

  it('deletes nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete Item' }));
    await user.click(screen.getByRole('button', { name: 'Batal' }));

    expect(mockDeleteReclassification).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Hapus Item Reclassification' })).not.toBeInTheDocument();
  });

  it('opens the edit modal with the clicked row', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit Item' }));

    expect(mockSetEditing).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-1' }));
    expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(true);
  });

  it('opens the verify modal from the verification badge', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Unverified' }));

    expect(mockSetVerifying).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-1' }));
    expect(mockSetIsVerifyModalOpen).toHaveBeenCalledWith(true);
  });

  it('shows an error Toast and dialog closes when deleteReclassification rejects (B2)', async () => {
    // Step 7b (B2): deleteReclassification now throws on Supabase error.
    // handleConfirmDelete closes the ConfirmModal first (setPendingDeleteId(null)),
    // awaits deleteReclassification, catches the error and stores it in actionError
    // which is rendered by the Toast component.
    const user = userEvent.setup();
    mockDeleteReclassification.mockRejectedValue(new Error('Connection refused'));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete Item' }));
    await user.click(screen.getByRole('button', { name: 'Hapus' }));

    // Confirm dialog closes
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Hapus Item Reclassification' })).not.toBeInTheDocument()
    );
    // Toast with error message appears
    expect(await screen.findByRole('status')).toHaveTextContent('Connection refused');
  });
});

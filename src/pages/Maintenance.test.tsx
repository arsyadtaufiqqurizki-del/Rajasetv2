import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Maintenance from './Maintenance';
import type { MaintenanceRecord } from '../types/maintenance';

// Characterization tests — Step 0 of "refactoring v2.md". Maintenance.tsx has no coverage
// today; Step 8 replaces its pagination block with usePagination and Step 7b (B2) changes
// how a failed deleteRecord surfaces. Both the happy path and the current silent-failure
// behaviour are pinned here.

const mockDeleteRecord = vi.fn();

let records: MaintenanceRecord[] = [];

vi.mock('../contexts/MaintenanceContext', () => ({
  useMaintenance: () => ({
    records,
    loading: false,
    error: null,
    addRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: mockDeleteRecord,
  }),
}));

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({ assets: [] }),
}));

function makeRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'm-1',
    assetBook: 'Corporate',
    subsidiary: 'PT Raja Prima',
    assetNumber: 'AN-001',
    assetDescription: 'Generator',
    assetUnits: '1',
    serviceType: 'Routine Service',
    assetCategorySegment1: 'Machinery',
    assetCategorySegment2: 'Plant A',
    estimateCost: '1000',
    actualCost: '',
    status: 'Pending',
    scheduledDate: '2026-12-01',
    ...overrides,
  };
}

/** 12 records, so the hard-coded itemsPerPage = 10 produces two pages. */
function makeRecords(count: number): MaintenanceRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makeRecord({ id: `m-${i + 1}`, assetNumber: `AN-${String(i + 1).padStart(3, '0')}`, assetDescription: `Record ${i + 1}` })
  );
}

function renderPage(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Maintenance />
    </MemoryRouter>
  );
}

function deleteButtons(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('button', { name: 'Delete' });
}

/** The confirm dialog's buttons, scoped away from the identically-named row buttons. */
function dialogButton(name: string | RegExp): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name });
}

/** StatCard renders label and value as siblings inside one card element. */
function statCard(label: string): HTMLElement {
  const card = screen.getByText(label).closest('div.rounded-xl');
  if (!card) throw new Error(`no stat card labelled ${label}`);
  return card as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  records = [makeRecord()];
  mockDeleteRecord.mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T03:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Maintenance — single record delete flow', () => {
  it('confirms first, then calls deleteRecord with the row id', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(deleteButtons()[0]);

    expect(screen.getByRole('heading', { name: 'Delete Record' })).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this maintenance record? This action cannot be undone.')
    ).toBeInTheDocument();
    expect(mockDeleteRecord).not.toHaveBeenCalled();

    await user.click(dialogButton('Delete'));

    await waitFor(() => expect(mockDeleteRecord).toHaveBeenCalledWith('m-1'));
  });

  it('deletes nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(deleteButtons()[0]);
    await user.click(dialogButton('Cancel'));

    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Delete Record' })).not.toBeInTheDocument();
  });

  it('shows a "Deleting..." busy state and blocks a second confirm while in flight', async () => {
    const user = userEvent.setup();
    let resolveDelete: () => void = () => {};
    mockDeleteRecord.mockImplementation(() => new Promise<void>((resolve) => { resolveDelete = resolve; }));
    renderPage();

    await user.click(deleteButtons()[0]);
    await user.click(dialogButton('Delete'));

    const busy = await screen.findByRole('button', { name: /Deleting\.\.\./ });
    expect(busy).toBeDisabled();
    expect(dialogButton('Cancel')).toBeDisabled();

    resolveDelete();
    await waitFor(() => expect(mockDeleteRecord).toHaveBeenCalledTimes(1));
  });

  it('deletes the row that was clicked, not the first one', async () => {
    const user = userEvent.setup();
    records = makeRecords(3);
    renderPage();

    await user.click(deleteButtons()[2]);
    await user.click(dialogButton('Delete'));

    await waitFor(() => expect(mockDeleteRecord).toHaveBeenCalledWith('m-3'));
  });

  it('shows an error Toast and keeps the dialog open when deleteRecord rejects (B2)', async () => {
    // Step 7b (B2): deleteRecord now throws on Supabase error.
    // Maintenance.tsx confirmDelete catches it in the catch block and stores the message
    // in deleteError which is surfaced via the Toast component. The ConfirmModal stays
    // open so the user can retry or cancel manually.
    const user = userEvent.setup();
    mockDeleteRecord.mockRejectedValue(new Error('Network error'));
    renderPage();

    await user.click(deleteButtons()[0]);
    await user.click(dialogButton('Delete'));

    // Toast with error message should appear
    expect(await screen.findByRole('status')).toHaveTextContent('Network error');
    // Dialog stays open — user can retry or cancel
    expect(screen.getByRole('heading', { name: 'Delete Record' })).toBeInTheDocument();
  });
});

describe('Maintenance — pagination', () => {
  it('shows 10 records on page 1 and the remainder on page 2', async () => {
    const user = userEvent.setup();
    records = makeRecords(12);
    renderPage();

    expect(screen.getByText('Showing 10 of 12 entries')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Record 1')).toBeInTheDocument();
    expect(screen.queryByText('Record 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 12 entries')).toBeInTheDocument();
    expect(screen.getByText('Record 11')).toBeInTheDocument();
  });

  it('reports a single page when a URL filter narrows the list', () => {
    records = [
      ...makeRecords(3),
      makeRecord({ id: 'm-99', subsidiary: 'PT Lain', assetDescription: 'Other' }),
    ];
    renderPage('/?subsidiary=PT+Lain');

    expect(screen.getByText('Showing 1 of 1 entries')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('shows an empty page-1 state with no records at all', () => {
    records = [];
    renderPage();

    expect(screen.getByText('Showing 0 of 0 entries')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});

describe('Maintenance — header metrics', () => {
  it('sums actual cost where present and falls back to the estimate otherwise', () => {
    records = [
      makeRecord({ id: 'm-1', estimateCost: '1000', actualCost: '$1,250.00' }),
      makeRecord({ id: 'm-2', estimateCost: '500', actualCost: '' }),
    ];
    renderPage();

    expect(screen.getByText('$1,750.00')).toBeInTheDocument();
  });

  it('counts Pending and In Progress as active, and Overdue separately', () => {
    records = [
      makeRecord({ id: 'm-1', status: 'Pending' }),
      makeRecord({ id: 'm-2', status: 'In Progress' }),
      makeRecord({ id: 'm-3', status: 'Overdue' }),
      makeRecord({ id: 'm-4', status: 'Completed' }),
    ];
    renderPage();

    expect(statCard('Assets Under Maint.')).toHaveTextContent('2');
    expect(statCard('Overdue Maintenance')).toHaveTextContent('1');
  });
});

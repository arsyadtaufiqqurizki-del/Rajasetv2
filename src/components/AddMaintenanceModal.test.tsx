import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import AddMaintenanceModal from './AddMaintenanceModal';
import type { Asset } from '../types/asset';

// Characterization tests — written before Step 7 of "refactoring v2.md" (extract
// ui/AssetPicker, adopt useEntityForm) touches this file. They pin what the modal
// does today, not what it should do: the asset picker's search/limit semantics, the
// exact addRecord payload assembled from the picked asset, and the reset-on-close.
//
// The inputs carry neither `id`/`htmlFor` nor `name`, so placeholders and roles are
// the only stable handles. Both survive Step 7 untouched.

const mockAddRecord = vi.fn();
const mockOnClose = vi.fn();
let mockAssets: Asset[] = [];

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({ assets: mockAssets }),
}));

vi.mock('../contexts/MaintenanceContext', () => ({
  useMaintenance: () => ({ addRecord: mockAddRecord }),
}));

function makeAsset(over: Partial<Asset> & { id: string }): Asset {
  return {
    assetBook: 'Corporate',
    subsidiary: 'PT Raja Prima',
    assetNumber: 'AST-001',
    assetDescription: 'Excavator',
    assetCost: '1000',
    datePlaceInService: '2026-01-01',
    assetUnits: '1',
    categorySegment1: 'Heavy Equipment',
    categorySegment2: 'Site A',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '60',
    listed: 'Non-Listed',
    status: 'Active',
    statusLevel: 'success',
    verification: false,
    verificationDate: '',
    itemStatus: 'Asset',
    createdAt: '2026-01-01',
    ...over,
  };
}

const SEARCH_PLACEHOLDER = 'Search asset number or description...';

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Select an asset' }));
}

/** Opens the asset dropdown and clicks the row whose asset number matches. */
function pickAsset(assetNumber: string) {
  openPicker();
  fireEvent.click(screen.getByText(assetNumber));
}

const scheduledDate = () => document.querySelector('input[type="date"]') as HTMLInputElement;
const statusRadio = (option: string) =>
  within(screen.getByRole('radiogroup', { name: 'Status' })).getByRole('radio', { name: option });
const byPlaceholder = (p: string) => screen.getByPlaceholderText(p) as HTMLInputElement;

function submit() {
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAssets = [
    makeAsset({ id: 'a1', assetNumber: 'AST-001', assetDescription: 'Excavator' }),
    makeAsset({ id: 'a2', assetNumber: 'AST-002', assetDescription: 'Generator', assetBook: '' }),
  ];
});

describe('AddMaintenanceModal — chrome', () => {
  it('renders nothing while closed', () => {
    render(<AddMaintenanceModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the add title and the Save Record button', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    expect(screen.getByRole('heading', { name: 'Add Maintenance Record' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Record' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('closes without saving when Cancel is pressed', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockAddRecord).not.toHaveBeenCalled();
  });

  it('defaults the scheduled date to today and the status to Pending', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    expect(scheduledDate()).toHaveValue(new Date().toISOString().split('T')[0]);
    expect(statusRadio('Pending')).toBeChecked();
  });
});

describe('AddMaintenanceModal — asset picker', () => {
  it('lists assets only after the dropdown is opened', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    expect(screen.queryByText('AST-001')).not.toBeInTheDocument();
    openPicker();
    expect(screen.getByText('AST-001')).toBeInTheDocument();
    expect(screen.getByText('AST-002')).toBeInTheDocument();
  });

  it('filters by asset number and by description, case-insensitively', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    openPicker();
    const search = byPlaceholder(SEARCH_PLACEHOLDER);

    fireEvent.change(search, { target: { value: 'ast-002' } });
    expect(screen.queryByText('AST-001')).not.toBeInTheDocument();
    expect(screen.getByText('AST-002')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'excav' } });
    expect(screen.getByText('AST-001')).toBeInTheDocument();
    expect(screen.queryByText('AST-002')).not.toBeInTheDocument();
  });

  it('shows the empty-state copy when nothing matches', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    openPicker();
    fireEvent.change(byPlaceholder(SEARCH_PLACEHOLDER), { target: { value: 'zzzz' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('caps the list at 50 and says so, but only while the search box is empty', () => {
    mockAssets = Array.from({ length: 60 }, (_, i) =>
      makeAsset({ id: `a${i}`, assetNumber: `AST-${String(i).padStart(3, '0')}` }),
    );
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    openPicker();

    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    expect(screen.getByText('Showing 50 of 60 assets. Type to search.')).toBeInTheDocument();

    fireEvent.change(byPlaceholder(SEARCH_PLACEHOLDER), { target: { value: 'AST-0' } });
    expect(screen.queryByText(/Showing 50 of/)).not.toBeInTheDocument();
  });

  it('closes the dropdown, clears the search and shows the picked asset in the trigger', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    pickAsset('AST-002');

    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AST-002 - Generator' })).toBeInTheDocument();
  });

  it('reveals the read-only summary of the picked asset', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    expect(screen.queryByText('Subsidiary:')).not.toBeInTheDocument();

    pickAsset('AST-001');

    expect(screen.getByText('Subsidiary:').parentElement).toHaveTextContent('PT Raja Prima');
    expect(screen.getByText('Asset Class:').parentElement).toHaveTextContent('Heavy Equipment');
    expect(screen.getByText('Location:').parentElement).toHaveTextContent('Site A');
    expect(screen.getByText('Units:').parentElement).toHaveTextContent('1');
  });
});

describe('AddMaintenanceModal — save flow', () => {
  it('assembles the record from the picked asset plus the typed fields', async () => {
    mockAddRecord.mockResolvedValue(undefined);
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);

    pickAsset('AST-001');
    fireEvent.change(scheduledDate(), { target: { value: '2026-10-01' } });
    fireEvent.change(byPlaceholder('e.g. Oil Change, Repair'), { target: { value: 'Oil Change' } });
    fireEvent.click(statusRadio('In Progress'));
    fireEvent.change(byPlaceholder('e.g. $500.00'), { target: { value: '$500.00' } });
    fireEvent.change(byPlaceholder('e.g. $450.00'), { target: { value: '$450.00' } });
    submit();

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockAddRecord).toHaveBeenCalledWith({
      assetBook: 'Corporate',
      subsidiary: 'PT Raja Prima',
      assetNumber: 'AST-001',
      assetDescription: 'Excavator',
      assetUnits: '1',
      serviceType: 'Oil Change',
      assetCategorySegment1: 'Heavy Equipment',
      assetCategorySegment2: 'Site A',
      estimateCost: '$500.00',
      actualCost: '$450.00',
      status: 'In Progress',
      scheduledDate: '2026-10-01',
    });
    // Drain the 600ms minimum-delay promise so it cannot fire into the next test.
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('falls back to the asset id when the asset has no book', async () => {
    mockAddRecord.mockResolvedValue(undefined);
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);

    pickAsset('AST-002');
    fireEvent.change(byPlaceholder('e.g. Oil Change, Repair'), { target: { value: 'Repair' } });
    submit();

    await waitFor(() => expect(mockAddRecord).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockAddRecord.mock.calls[0][0]).toMatchObject({ assetBook: 'a2' });
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('closes the modal after a successful save', async () => {
    mockAddRecord.mockResolvedValue(undefined);
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);

    pickAsset('AST-001');
    submit();

    await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('does nothing at all when no asset has been picked', async () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    fireEvent.change(byPlaceholder('e.g. Oil Change, Repair'), { target: { value: 'Oil Change' } });
    submit();

    await Promise.resolve();
    expect(mockAddRecord).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('swaps the button for a spinner label and disables the chrome while saving', async () => {
    let release: () => void = () => {};
    mockAddRecord.mockImplementation(() => new Promise<void>(res => { release = () => res(); }));
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);

    pickAsset('AST-001');
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Record' })).not.toBeInTheDocument();

    release();
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('blanks the form once the modal has been closed and reopened', () => {
    const { rerender } = render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    pickAsset('AST-001');
    fireEvent.change(byPlaceholder('e.g. Oil Change, Repair'), { target: { value: 'Oil Change' } });

    rerender(<AddMaintenanceModal isOpen={false} onClose={mockOnClose} />);
    rerender(<AddMaintenanceModal isOpen onClose={mockOnClose} />);

    expect(screen.getByRole('button', { name: 'Select an asset' })).toBeInTheDocument();
    expect(byPlaceholder('e.g. Oil Change, Repair')).toHaveValue('');
  });
});

// Step 7a (B1) — the hand-rolled `fixed inset-0` chrome was replaced by ui/FormModal,
// so the dialog now renders through a portal and gains Esc, a focus trap and a body
// scroll lock. These pin the three close paths and the autofocus target: the header's
// X button, NOT the asset picker (which would otherwise pop its dropdown open on mount).
describe('AddMaintenanceModal — ui/FormModal chrome', () => {
  const closeButton = () => screen.getAllByRole('button').find(b => b.textContent === '') as HTMLElement;

  it('labels the dialog with the heading it renders', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    const heading = screen.getByRole('heading', { name: 'Add Maintenance Record' });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('closes when the header X button is pressed', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    fireEvent.click(closeButton());
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockAddRecord).not.toHaveBeenCalled();
  });

  it('closes when Esc is pressed', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Esc while a save is in flight', async () => {
    let release!: () => void;
    mockAddRecord.mockReturnValue(new Promise<void>(r => { release = r; }));
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    pickAsset('AST-001');
    fireEvent.change(byPlaceholder('e.g. Oil Change, Repair'), { target: { value: 'Oil Change' } });
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('puts the initial focus on the close button, leaving the asset dropdown shut', () => {
    render(<AddMaintenanceModal isOpen onClose={mockOnClose} />);
    expect(document.activeElement).toBe(closeButton());
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });
});

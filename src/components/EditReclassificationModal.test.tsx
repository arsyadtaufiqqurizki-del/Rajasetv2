import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EditReclassificationModal from './EditReclassificationModal';
import type { Reclassification } from '../types/reclassification';

// Characterization tests — written before Step 7 of "refactoring v2.md" adopts
// useEntityForm here. The domain difference this modal carries is the linked vs
// unlinked split: a row mirroring Asset Inventory locks its identity fields and only
// lets the audit-owned classification and remarks through. That split is pinned here
// so Step 7 cannot quietly flatten it into the Add modal's shape.

const mockUpdate = vi.fn();
const mockSetIsEditModalOpen = vi.fn();
const mockSetEditingReclassification = vi.fn();
let mockIsEditModalOpen = true;
let mockEditing: Reclassification | null = null;

vi.mock('../contexts/ReclassificationContext', () => ({
  useReclassification: () => ({
    isEditModalOpen: mockIsEditModalOpen,
    setIsEditModalOpen: mockSetIsEditModalOpen,
    editingReclassification: mockEditing,
    setEditingReclassification: mockSetEditingReclassification,
    updateReclassification: mockUpdate,
  }),
  RECLASSIFICATION_PRESET_CATEGORIES: ['Asset', 'Needs Review', 'Inventory'],
}));

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({
    categories1: ['Elektronik'],
    categories2: ['Gudang A'],
    subsidiaries: ['Divisi Operasional'],
  }),
}));

function makeRow(over: Partial<Reclassification> = {}): Reclassification {
  return {
    id: 'r1',
    assetId: null,
    linkedAssetNumber: '',
    assetCategory: 'Elektronik',
    assetDescription: 'Kompresor GA-30',
    location: 'Gudang A',
    unit: '2',
    ownership: 'Divisi Operasional',
    category: 'Needs Review',
    remarks: 'Perlu dicek ulang',
    assetDeletedAt: null,
    verified: false,
    verificationDate: '',
    verifiedBy: '',
    createdAt: '2026-01-01',
    ...over,
  };
}

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const categorySelect = () => screen.getByRole('combobox') as HTMLSelectElement;

function setField(name: string, value: string) {
  fireEvent.change(field(name), { target: { value } });
}

function submit() {
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsEditModalOpen = true;
  mockEditing = makeRow();
});

describe('EditReclassificationModal — mount condition', () => {
  it('renders nothing while the modal flag is off', () => {
    mockIsEditModalOpen = false;
    render(<EditReclassificationModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when no row is being edited', () => {
    mockEditing = null;
    render(<EditReclassificationModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('EditReclassificationModal — chrome', () => {
  it('shows the edit title and the Update button', () => {
    render(<EditReclassificationModal />);
    expect(screen.getByRole('heading', { name: 'Edit Item Reclassification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
  });

  it('clears both the flag and the edited row when Cancel is pressed', () => {
    render(<EditReclassificationModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetEditingReclassification).toHaveBeenCalledWith(null);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('EditReclassificationModal — hydration', () => {
  it('fills every field from the row being edited', () => {
    render(<EditReclassificationModal />);
    expect(field('assetDescription')).toHaveValue('Kompresor GA-30');
    expect(field('assetCategory')).toHaveValue('Elektronik');
    expect(field('location')).toHaveValue('Gudang A');
    expect(field('unit')).toHaveValue(2);
    expect(field('ownership')).toHaveValue('Divisi Operasional');
    expect(field('remarks')).toHaveValue('Perlu dicek ulang');
  });

  it('selects the stored category when it is one of the presets', () => {
    render(<EditReclassificationModal />);
    expect(categorySelect()).toHaveValue('Needs Review');
    expect(screen.queryByPlaceholderText('e.g. Barang Hilang')).not.toBeInTheDocument();
  });

  it('falls back to Custom and prefills the custom name for a non-preset category', () => {
    mockEditing = makeRow({ category: 'Barang Hilang' });
    render(<EditReclassificationModal />);
    expect(categorySelect()).toHaveValue('Custom');
    expect(screen.getByPlaceholderText('e.g. Barang Hilang')).toHaveValue('Barang Hilang');
  });
});

describe('EditReclassificationModal — linked vs unlinked', () => {
  it('leaves every identity field editable on an unlinked row', () => {
    render(<EditReclassificationModal />);
    expect(screen.queryByText(/tertaut ke Asset Inventory/)).not.toBeInTheDocument();
    expect(field('assetDescription')).toBeEnabled();
    expect(field('assetCategory')).toBeEnabled();
    expect(field('location')).toBeEnabled();
    expect(field('unit')).toBeEnabled();
    expect(field('ownership')).toBeEnabled();
  });

  it('locks the identity fields and explains why on a linked row', () => {
    mockEditing = makeRow({ assetId: 'a1', linkedAssetNumber: 'AST-001' });
    render(<EditReclassificationModal />);

    expect(screen.getByText(/tertaut ke Asset Inventory \(#AST-001\)/)).toBeInTheDocument();
    expect(field('assetDescription')).toBeDisabled();
    expect(field('unit')).toBeDisabled();
    // Category/location/ownership swap the autocomplete for a plain disabled input,
    // so they no longer carry a name attribute at all.
    expect(field('assetCategory')).toBeNull();
    expect(field('location')).toBeNull();
    expect(field('ownership')).toBeNull();
  });

  it('keeps the classification and the remarks editable on a linked row', () => {
    mockEditing = makeRow({ assetId: 'a1', linkedAssetNumber: 'AST-001' });
    render(<EditReclassificationModal />);
    expect(categorySelect()).toBeEnabled();
    expect(field('remarks')).toBeEnabled();
  });

  it('omits the asset number from the banner when the link has none', () => {
    mockEditing = makeRow({ assetId: 'a1', linkedAssetNumber: '' });
    render(<EditReclassificationModal />);
    expect(screen.getByText(/tertaut ke Asset Inventory\./)).toBeInTheDocument();
  });
});

describe('EditReclassificationModal — save flow', () => {
  it('sends the row id with the edited fields and the resolved category', async () => {
    mockUpdate.mockResolvedValue(undefined);
    render(<EditReclassificationModal />);

    setField('assetDescription', 'Kompresor GA-30 (revisi)');
    setField('unit', '3');
    fireEvent.change(categorySelect(), { target: { value: 'Inventory' } });
    submit();

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockUpdate).toHaveBeenCalledWith('r1', {
      assetCategory: 'Elektronik',
      assetDescription: 'Kompresor GA-30 (revisi)',
      location: 'Gudang A',
      unit: '3',
      ownership: 'Divisi Operasional',
      remarks: 'Perlu dicek ulang',
      category: 'Inventory',
    });
    await waitFor(() => expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });

  it('trims the custom category before sending it', async () => {
    mockUpdate.mockResolvedValue(undefined);
    render(<EditReclassificationModal />);

    fireEvent.change(categorySelect(), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Barang Hilang'), { target: { value: '  Barang Hilang  ' } });
    submit();

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ category: 'Barang Hilang' });
    await waitFor(() => expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });

  it('refuses to save a blank custom category', async () => {
    render(<EditReclassificationModal />);

    fireEvent.change(categorySelect(), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Barang Hilang'), { target: { value: '   ' } });
    submit();

    await Promise.resolve();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('clears both the flag and the edited row after a successful save', async () => {
    mockUpdate.mockResolvedValue(undefined);
    render(<EditReclassificationModal />);
    submit();

    await waitFor(() => expect(mockSetEditingReclassification).toHaveBeenCalledWith(null), { timeout: 3000 });
    expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false);
  });

  it('swaps the button for the Updating label and disables the chrome while saving', async () => {
    let release: () => void = () => {};
    mockUpdate.mockImplementation(() => new Promise<void>(res => { release = () => res(); }));
    render(<EditReclassificationModal />);
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Updating/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Update' })).not.toBeInTheDocument();

    release();
    await waitFor(() => expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });
});

// Step 7a (B1) — hand-rolled chrome replaced by ui/FormModal: portal, Esc, focus trap,
// body scroll lock. Both new close paths must clear the flag AND the edited row, the
// same pair Cancel already clears.
describe('EditReclassificationModal — ui/FormModal chrome', () => {
  const closeButton = () => screen.getAllByRole('button').find(b => b.textContent === '') as HTMLElement;

  it('labels the dialog with the heading it renders', () => {
    render(<EditReclassificationModal />);
    const heading = screen.getByRole('heading', { name: 'Edit Item Reclassification' });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('clears both the flag and the edited row when the header X button is pressed', () => {
    render(<EditReclassificationModal />);
    fireEvent.click(closeButton());
    expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetEditingReclassification).toHaveBeenCalledWith(null);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('clears both the flag and the edited row when Esc is pressed', () => {
    render(<EditReclassificationModal />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetEditingReclassification).toHaveBeenCalledWith(null);
  });

  it('ignores Esc while a save is in flight', async () => {
    let release!: () => void;
    mockUpdate.mockReturnValue(new Promise<void>(r => { release = r; }));
    render(<EditReclassificationModal />);
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Updating/ })).toBeDisabled());
    mockSetIsEditModalOpen.mockClear();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetIsEditModalOpen).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(<EditReclassificationModal />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

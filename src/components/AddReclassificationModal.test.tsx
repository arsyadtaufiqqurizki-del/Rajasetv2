import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AddReclassificationModal from './AddReclassificationModal';
import type { Asset } from '../types/asset';
import type { Reclassification } from '../types/reclassification';

// Characterization tests — written before Step 7 of "refactoring v2.md" (extract
// ui/AssetPicker, adopt useEntityForm) touches this file. They pin the current
// behaviour: only assets not already linked are pickable, the preset/Custom category
// switch, the addLinkedReclassification arguments, and the error banner — this is the
// one modal of the four whose context call actually throws, so the banner is reachable.

const mockAddLinked = vi.fn();
const mockSetIsAddModalOpen = vi.fn();
let mockAssets: Asset[] = [];
let mockReclassifications: Reclassification[] = [];
let mockIsAddModalOpen = true;

vi.mock('../contexts/ReclassificationContext', () => ({
  useReclassification: () => ({
    isAddModalOpen: mockIsAddModalOpen,
    setIsAddModalOpen: mockSetIsAddModalOpen,
    addLinkedReclassification: mockAddLinked,
    reclassifications: mockReclassifications,
  }),
  RECLASSIFICATION_PRESET_CATEGORIES: ['Asset', 'Needs Review', 'Inventory'],
}));

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({ assets: mockAssets }),
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

function makeRow(over: Partial<Reclassification> & { id: string }): Reclassification {
  return {
    assetId: null,
    linkedAssetNumber: '',
    assetCategory: '',
    assetDescription: '',
    location: '',
    unit: '1',
    ownership: '',
    category: 'Asset',
    remarks: '',
    assetDeletedAt: null,
    verified: false,
    verificationDate: '',
    verifiedBy: '',
    createdAt: '2026-01-01',
    ...over,
  };
}

const SEARCH_PLACEHOLDER = 'Cari asset number atau deskripsi...';
const TRIGGER = 'Pilih asset dari Inventory';

const categorySelect = () => screen.getByRole('combobox') as HTMLSelectElement;
const remarks = () => screen.getByPlaceholderText('Catatan tambahan (opsional)') as HTMLTextAreaElement;

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: TRIGGER }));
}

function pickAsset(assetNumber: string) {
  openPicker();
  fireEvent.click(screen.getByText(assetNumber));
}

function submit() {
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAddModalOpen = true;
  mockReclassifications = [];
  mockAssets = [
    makeAsset({ id: 'a1', assetNumber: 'AST-001', assetDescription: 'Excavator' }),
    makeAsset({ id: 'a2', assetNumber: 'AST-002', assetDescription: 'Generator' }),
  ];
});

describe('AddReclassificationModal — chrome', () => {
  it('renders nothing while the modal flag is off', () => {
    mockIsAddModalOpen = false;
    render(<AddReclassificationModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the add title and the Simpan button', () => {
    render(<AddReclassificationModal />);
    expect(screen.getByRole('heading', { name: 'Tambah Item Reclassification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
  });

  it('closes through the context flag when Cancel is pressed', () => {
    render(<AddReclassificationModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false);
    expect(mockAddLinked).not.toHaveBeenCalled();
  });

  it('keeps Simpan disabled until an asset is picked', () => {
    render(<AddReclassificationModal />);
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
    pickAsset('AST-001');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
  });
});

describe('AddReclassificationModal — asset picker', () => {
  it('hides assets that already have a reclassification row', () => {
    mockReclassifications = [makeRow({ id: 'r1', assetId: 'a1' })];
    render(<AddReclassificationModal />);
    openPicker();

    expect(screen.queryByText('AST-001')).not.toBeInTheDocument();
    expect(screen.getByText('AST-002')).toBeInTheDocument();
  });

  it('ignores unlinked rows when working out what is already linked', () => {
    mockReclassifications = [makeRow({ id: 'r1', assetId: null })];
    render(<AddReclassificationModal />);
    openPicker();

    expect(screen.getByText('AST-001')).toBeInTheDocument();
    expect(screen.getByText('AST-002')).toBeInTheDocument();
  });

  it('filters by asset number and by description', () => {
    render(<AddReclassificationModal />);
    openPicker();
    const search = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);

    fireEvent.change(search, { target: { value: 'generator' } });
    expect(screen.queryByText('AST-001')).not.toBeInTheDocument();
    expect(screen.getByText('AST-002')).toBeInTheDocument();
  });

  it('shows the empty-state copy when nothing matches', () => {
    render(<AddReclassificationModal />);
    openPicker();
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'zzzz' } });
    expect(screen.getByText('Tidak ada hasil')).toBeInTheDocument();
  });

  it('caps the list at 50 and counts only the linkable assets in the hint', () => {
    mockAssets = Array.from({ length: 60 }, (_, i) =>
      makeAsset({ id: `a${i}`, assetNumber: `AST-${String(i).padStart(3, '0')}` }),
    );
    mockReclassifications = [makeRow({ id: 'r1', assetId: 'a0' })];
    render(<AddReclassificationModal />);
    openPicker();

    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    expect(screen.getByText('Menampilkan 50 dari 59 asset. Ketik untuk mencari.')).toBeInTheDocument();
  });

  it('reveals the audit-facing summary of the picked asset', () => {
    render(<AddReclassificationModal />);
    expect(screen.queryByText('Asset Class:')).not.toBeInTheDocument();

    pickAsset('AST-001');

    expect(screen.getByText('Asset Class:').parentElement).toHaveTextContent('Heavy Equipment');
    expect(screen.getByText('Location:').parentElement).toHaveTextContent('Site A');
    expect(screen.getByText('Ownership:').parentElement).toHaveTextContent('PT Raja Prima');
    expect(screen.getByText('Unit:').parentElement).toHaveTextContent('1');
  });
});

describe('AddReclassificationModal — classification', () => {
  it('starts on the first preset and offers the rest plus Custom', () => {
    render(<AddReclassificationModal />);
    expect(categorySelect()).toHaveValue('Asset');
    expect(
      Array.from(categorySelect().options).map(o => o.value),
    ).toEqual(['Asset', 'Needs Review', 'Inventory', 'Custom']);
  });

  it('reveals the custom name field only when Custom is picked', () => {
    render(<AddReclassificationModal />);
    expect(screen.queryByPlaceholderText('e.g. Barang Hilang')).not.toBeInTheDocument();

    fireEvent.change(categorySelect(), { target: { value: 'Custom' } });
    expect(screen.getByPlaceholderText('e.g. Barang Hilang')).toBeInTheDocument();
  });
});

describe('AddReclassificationModal — save flow', () => {
  it('sends the asset id, the preset category and the remarks', async () => {
    mockAddLinked.mockResolvedValue(undefined);
    render(<AddReclassificationModal />);

    pickAsset('AST-002');
    fireEvent.change(categorySelect(), { target: { value: 'Needs Review' } });
    fireEvent.change(remarks(), { target: { value: 'Ditemukan di gudang B' } });
    submit();

    await waitFor(() => expect(mockAddLinked).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockAddLinked).toHaveBeenCalledWith('a2', 'Needs Review', 'Ditemukan di gudang B');
    await waitFor(() => expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });

  it('trims the custom category before sending it', async () => {
    mockAddLinked.mockResolvedValue(undefined);
    render(<AddReclassificationModal />);

    pickAsset('AST-001');
    fireEvent.change(categorySelect(), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Barang Hilang'), { target: { value: '  Barang Hilang  ' } });
    submit();

    await waitFor(() => expect(mockAddLinked).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockAddLinked).toHaveBeenCalledWith('a1', 'Barang Hilang', '');
    await waitFor(() => expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });

  it('refuses to save a blank custom category', async () => {
    render(<AddReclassificationModal />);

    pickAsset('AST-001');
    fireEvent.change(categorySelect(), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Barang Hilang'), { target: { value: '   ' } });
    submit();

    await Promise.resolve();
    expect(mockAddLinked).not.toHaveBeenCalled();
  });

  it('does nothing when no asset has been picked', async () => {
    render(<AddReclassificationModal />);
    submit();

    await Promise.resolve();
    expect(mockAddLinked).not.toHaveBeenCalled();
  });

  it('shows the error banner and stays open when the save is rejected', async () => {
    mockAddLinked.mockRejectedValue(new Error('duplicate key value'));
    render(<AddReclassificationModal />);

    pickAsset('AST-001');
    submit();

    await waitFor(
      () => expect(screen.getByText('Gagal menyimpan item: duplicate key value')).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(mockSetIsAddModalOpen).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
  });

  it('swaps the button for a spinner label and disables the chrome while saving', async () => {
    let release: () => void = () => {};
    mockAddLinked.mockImplementation(() => new Promise<void>(res => { release = () => res(); }));
    render(<AddReclassificationModal />);

    pickAsset('AST-001');
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Simpan' })).not.toBeInTheDocument();

    release();
    await waitFor(() => expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });
});

// Step 7a (B1) — the hand-rolled `fixed inset-0 z-[100]` chrome was replaced by
// ui/FormModal, so the dialog now renders through a portal and gains Esc, a focus trap
// and a body scroll lock. The autofocus lands on the header X button, NOT the asset
// picker — otherwise its dropdown would pop open on mount.
describe('AddReclassificationModal — ui/FormModal chrome', () => {
  const closeButton = () => screen.getAllByRole('button').find(b => b.textContent === '') as HTMLElement;

  it('labels the dialog with the heading it renders', () => {
    render(<AddReclassificationModal />);
    const heading = screen.getByRole('heading', { name: 'Tambah Item Reclassification' });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('closes through the context flag when the header X button is pressed', () => {
    render(<AddReclassificationModal />);
    fireEvent.click(closeButton());
    expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false);
    expect(mockAddLinked).not.toHaveBeenCalled();
  });

  it('closes through the context flag when Esc is pressed', () => {
    render(<AddReclassificationModal />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false);
  });

  it('ignores Esc while a save is in flight', async () => {
    let release!: () => void;
    mockAddLinked.mockReturnValue(new Promise<void>(r => { release = r; }));
    render(<AddReclassificationModal />);
    pickAsset('AST-001');
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled());
    mockSetIsAddModalOpen.mockClear();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetIsAddModalOpen).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false), { timeout: 3000 });
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(<AddReclassificationModal />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('puts the initial focus on the close button, leaving the asset dropdown shut', () => {
    render(<AddReclassificationModal />);
    expect(document.activeElement).toBe(closeButton());
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditAssetModal from './EditAssetModal';
import type { Asset } from '../types/asset';

// Characterization tests — Step 0 of "refactoring v2.md". Step 6 merges this modal
// with AddAssetModal, and §4 Step 6 lists four differences that must survive that
// merge. Each one has a test below:
//   1. Edit re-formats assetCost on hydration; Add does not.
//   2. Edit says "Edit Asset" / "Update Asset"; Add says "Add New Asset" / "Save Asset".
//   3. Edit returns null when editingAsset is empty; Add always mounts.
//   4. Edit reports "Failed to update asset"; Add reports "Failed to save asset".

const mockUpdateAsset = vi.fn();
const mockSetIsEditModalOpen = vi.fn();
const mockSetEditingAsset = vi.fn();
let editingAsset: Asset | null = null;

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({
    isEditModalOpen: true,
    setIsEditModalOpen: mockSetIsEditModalOpen,
    updateAsset: mockUpdateAsset,
    editingAsset,
    setEditingAsset: mockSetEditingAsset,
    subsidiaries: ['PT Raja Prima'],
    categories1: ['Electronics'],
    categories2: ['HQ'],
    itemStatuses: ['Asset'],
  }),
}));

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    assetBook: 'Corporate',
    subsidiary: 'PT Raja Prima',
    assetNumber: 'AST-2026-001',
    assetDescription: 'MacBook Pro M3',
    assetCost: '2499.00',
    datePlaceInService: '2026-01-15',
    assetUnits: '1',
    categorySegment1: 'Electronics',
    categorySegment2: 'HQ',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '60',
    listed: 'Audited',
    status: 'Active',
    statusLevel: 'success',
    verification: true,
    verificationDate: '2026-02-01',
    itemStatus: 'Asset',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Inputs have no htmlFor/id wiring, so name= is the only stable handle. */
function field(name: string): HTMLInputElement {
  const el = document.querySelector(`input[name="${name}"]`);
  if (!el) throw new Error(`no input named ${name}`);
  return el as HTMLInputElement;
}

function setField(name: string, value: string) {
  fireEvent.change(field(name), { target: { value } });
}

function radio(group: string, option: string): HTMLInputElement {
  return within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', {
    name: new RegExp(`^${option}`),
  }) as HTMLInputElement;
}

function submit() {
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  editingAsset = makeAsset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T03:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EditAssetModal — mount condition (difference 3)', () => {
  it('renders nothing when there is no asset being edited', () => {
    editingAsset = null;
    const { container } = render(<EditAssetModal />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('EditAssetModal — hydration from editingAsset', () => {
  it('copies every field of the asset into the form', () => {
    render(<EditAssetModal />);

    expect(field('assetBook').value).toBe('Corporate');
    expect(field('subsidiary').value).toBe('PT Raja Prima');
    expect(field('assetNumber').value).toBe('AST-2026-001');
    expect(field('assetDescription').value).toBe('MacBook Pro M3');
    expect(field('datePlaceInService').value).toBe('2026-01-15');
    expect(field('assetUnits').value).toBe('1');
    expect(field('categorySegment1').value).toBe('Electronics');
    expect(field('categorySegment2').value).toBe('HQ');
    expect(field('lifeInMonths').value).toBe('60');
    expect(field('verificationDate').value).toBe('2026-02-01');
    expect(radio('Item Status', 'Asset').checked).toBe(true);
    expect(radio('Listed', 'Audited').checked).toBe(true);
    expect(radio('Verification', 'Yes').checked).toBe(true);
    expect(radio('Status', 'Active').checked).toBe(true);
  });

  it.each([
    ['2499.00', '2,499.00'],
    ['1234567', '1,234,567'],
    ['1234567.89', '1,234,567.89'],
    ['', ''],
    ['.5', '.5'],
  ])('re-formats a stored cost of %s as %s (difference 1)', (stored, shown) => {
    editingAsset = makeAsset({ assetCost: stored });
    render(<EditAssetModal />);

    expect(field('assetCost').value).toBe(shown);
  });

  it('maps verification=false to a "No" radio', () => {
    editingAsset = makeAsset({ verification: false, listed: 'Non-Listed', verificationDate: '' });
    render(<EditAssetModal />);

    expect(radio('Verification', 'No').checked).toBe(true);
    expect(field('verificationDate').value).toBe('');
  });

  it('checks Unlimited when the stored life is "Unlimited"', () => {
    editingAsset = makeAsset({ lifeInMonths: 'Unlimited' });
    render(<EditAssetModal />);

    expect(screen.getByRole('checkbox', { name: 'Unlimited' })).toBeChecked();
    expect(field('lifeInMonths').value).toBe('Unlimited');
    expect(field('lifeInMonths')).toBeDisabled();
  });

  it('falls back to empty strings for nullable columns', () => {
    editingAsset = makeAsset({
      subsidiary: '',
      verificationDate: '',
      itemStatus: '',
    });
    render(<EditAssetModal />);

    expect(field('subsidiary').value).toBe('');
    expect(field('verificationDate').value).toBe('');
    expect(radio('Item Status', 'Asset').checked).toBe(false);
    expect(radio('Item Status', 'Inventory').checked).toBe(false);
    expect(radio('Item Status', 'Needs Review').checked).toBe(false);
  });
});

describe('EditAssetModal — save flow', () => {
  it('calls updateAsset with the asset id and a comma-stripped, boolean-verified payload', async () => {
    mockUpdateAsset.mockResolvedValue(undefined);
    render(<EditAssetModal />);

    setField('assetDescription', 'MacBook Pro M4');
    setField('assetCost', '3199.50');
    submit();

    await waitFor(() => expect(mockUpdateAsset).toHaveBeenCalledTimes(1));
    expect(mockUpdateAsset).toHaveBeenCalledWith('asset-1', {
      assetBook: 'Corporate',
      subsidiary: 'PT Raja Prima',
      assetNumber: 'AST-2026-001',
      assetDescription: 'MacBook Pro M4',
      assetCost: '3199.50', // shown as "3,199.50"
      datePlaceInService: '2026-01-15',
      assetUnits: '1',
      categorySegment1: 'Electronics',
      categorySegment2: 'HQ',
      depreciationMethod: 'Straight Line',
      lifeInMonths: '60',
      listed: 'Audited',
      status: 'Active',
      verification: true,
      verificationDate: '2026-02-01',
      itemStatus: 'Asset',
    });
    expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetEditingAsset).toHaveBeenCalledWith(null);
  });

  it('reports "Failed to update asset" and stays open when updateAsset rejects (difference 4)', async () => {
    mockUpdateAsset.mockRejectedValue(new Error('row not found'));
    render(<EditAssetModal />);

    submit();

    expect(await screen.findByText('Failed to update asset: row not found')).toBeInTheDocument();
    expect(mockSetIsEditModalOpen).not.toHaveBeenCalled();
    expect(mockSetEditingAsset).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the rejection is not an Error', async () => {
    mockUpdateAsset.mockRejectedValue('boom');
    render(<EditAssetModal />);

    submit();

    expect(
      await screen.findByText('Failed to update asset: An unexpected error occurred.')
    ).toBeInTheDocument();
  });
});

describe('EditAssetModal — Listed <-> Verification cross-field rule', () => {
  it('forces Verification to Yes when Listed is set to Audited', async () => {
    const user = userEvent.setup();
    editingAsset = makeAsset({ listed: 'Non-Listed', verification: false, verificationDate: '' });
    render(<EditAssetModal />);

    expect(radio('Verification', 'No')).toBeEnabled();

    await user.click(radio('Listed', 'Audited'));

    expect(radio('Verification', 'Yes').checked).toBe(true);
    expect(radio('Verification', 'No')).toBeDisabled();
    expect(field('verificationDate').value).toBe('2026-09-10');
  });

  it('keeps an existing Verification Date rather than stamping today', async () => {
    const user = userEvent.setup();
    editingAsset = makeAsset({ listed: 'Non-Listed', verification: true, verificationDate: '2026-02-01' });
    render(<EditAssetModal />);

    await user.click(radio('Listed', 'Audited'));

    expect(field('verificationDate').value).toBe('2026-02-01');
  });

  it('clears the Verification Date when Verification flips to No', async () => {
    const user = userEvent.setup();
    editingAsset = makeAsset({ listed: 'Non-Listed' });
    render(<EditAssetModal />);

    await user.click(radio('Verification', 'No'));

    expect(field('verificationDate').value).toBe('');
    expect(field('verificationDate')).toBeDisabled();
  });
});

describe('EditAssetModal — chrome (difference 2)', () => {
  it('is titled "Edit Asset" with an "Update Asset" submit button', () => {
    render(<EditAssetModal />);

    expect(screen.getByRole('heading', { name: 'Edit Asset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Asset' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Asset' })).not.toBeInTheDocument();
  });

  it('clears editingAsset as well as the open flag on Cancel', async () => {
    const user = userEvent.setup();
    render(<EditAssetModal />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockSetIsEditModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetEditingAsset).toHaveBeenCalledWith(null);
    expect(mockUpdateAsset).not.toHaveBeenCalled();
  });
});

describe('EditAssetModal — typing (B6 regression)', () => {
  // Same defect as AddAssetModal: ui/Modal re-ran its focus effect on every render
  // because handleClose is recreated each time, so a typed space hit the X button.
  it('keeps focus in the field and accepts a space instead of closing', async () => {
    const user = userEvent.setup();
    render(<EditAssetModal />);

    const description = field('assetDescription');
    await user.clear(description);
    await user.keyboard('MacBook Air M4');

    expect(description.value).toBe('MacBook Air M4');
    expect(document.activeElement).toBe(field('assetDescription'));
    expect(mockSetIsEditModalOpen).not.toHaveBeenCalled();
    expect(mockSetEditingAsset).not.toHaveBeenCalled();
  });
});

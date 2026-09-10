import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddAssetModal from './AddAssetModal';

// Characterization tests — Step 0 of "refactoring v2.md". These pin the CURRENT
// behaviour of AddAssetModal before Step 2 (extract lib/assetRules + money.formatCostInput),
// Step 5 (ui/FormModal) and Step 6 (merge with EditAssetModal) start moving the code.
// Nothing here asserts what the behaviour *should* be — only what it is today.
//
// Fields are filled with fireEvent.change rather than userEvent.type for speed —
// this modal has 16 of them. The "typing" block at the bottom covers real keystrokes.

const mockAddAsset = vi.fn();
const mockSetIsAddModalOpen = vi.fn();

vi.mock('../contexts/AssetContext', () => ({
  useAsset: () => ({
    isAddModalOpen: true,
    setIsAddModalOpen: mockSetIsAddModalOpen,
    addAsset: mockAddAsset,
    subsidiaries: ['PT Raja Prima'],
    categories1: ['Electronics'],
    categories2: ['HQ'],
    itemStatuses: ['Asset'],
  }),
}));

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

function fillRequiredFields() {
  setField('assetBook', 'Corporate');
  setField('subsidiary', 'PT Raja Prima');
  setField('assetNumber', 'AST-2026-001');
  setField('assetDescription', 'MacBook Pro M3');
  setField('assetCost', '2499.00');
  setField('datePlaceInService', '2026-01-15');
}

function submit() {
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Only Date is faked — the components rely on real timers/microtasks.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T03:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AddAssetModal — save flow', () => {
  it('strips thousand separators and converts verification to a boolean before calling addAsset', async () => {
    mockAddAsset.mockResolvedValue(undefined);
    render(<AddAssetModal />);

    fillRequiredFields();
    submit();

    await waitFor(() => expect(mockAddAsset).toHaveBeenCalledTimes(1));
    expect(mockAddAsset).toHaveBeenCalledWith({
      assetBook: 'Corporate',
      subsidiary: 'PT Raja Prima',
      assetNumber: 'AST-2026-001',
      assetDescription: 'MacBook Pro M3',
      assetCost: '2499.00', // shown as "2,499.00", commas stripped on save
      datePlaceInService: '2026-01-15',
      assetUnits: '1',
      categorySegment1: '',
      categorySegment2: '',
      depreciationMethod: 'Straight Line',
      lifeInMonths: '60',
      // Listed defaults to Audited but verification defaults to the string 'No',
      // so an untouched form saves verification=false even though the UI claims
      // "Audited requires Yes". The Audited->Yes rule only fires on a Listed change.
      listed: 'Audited',
      status: 'Active',
      verification: false,
      verificationDate: '',
      itemStatus: '',
    });
    expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false);
  });

  it('keeps the modal open and shows a "Failed to save asset" banner when addAsset rejects', async () => {
    mockAddAsset.mockRejectedValue(new Error('duplicate key value'));
    render(<AddAssetModal />);

    fillRequiredFields();
    submit();

    expect(await screen.findByText('Failed to save asset: duplicate key value')).toBeInTheDocument();
    expect(mockSetIsAddModalOpen).not.toHaveBeenCalled();
    // Save button returns to its idle label, so the user can retry.
    expect(screen.getByRole('button', { name: 'Save Asset' })).toBeEnabled();
  });

  it('falls back to a generic message when the rejection is not an Error', async () => {
    mockAddAsset.mockRejectedValue('boom');
    render(<AddAssetModal />);

    fillRequiredFields();
    submit();

    expect(
      await screen.findByText('Failed to save asset: An unexpected error occurred.')
    ).toBeInTheDocument();
  });

  it('clears a previous error banner when the next save succeeds', async () => {
    mockAddAsset.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(undefined);
    render(<AddAssetModal />);

    fillRequiredFields();
    submit();
    await screen.findByText('Failed to save asset: network down');

    submit();
    await waitFor(() => expect(screen.queryByText(/Failed to save asset/)).not.toBeInTheDocument());
  });
});

describe('AddAssetModal — Listed <-> Verification cross-field rule', () => {
  it('opens with Listed=Audited and Verification pinned to a disabled "No"', () => {
    render(<AddAssetModal />);

    expect(radio('Listed', 'Audited').checked).toBe(true);
    expect(radio('Verification', 'No').checked).toBe(true);
    expect(radio('Verification', 'No')).toBeDisabled();
    expect(screen.getByText('(Audited requires Yes)')).toBeInTheDocument();
  });

  it('forces Verification to Yes and stamps today when Listed is set to Audited', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(radio('Listed', 'Non-Listed'));
    expect(radio('Verification', 'No')).toBeEnabled();

    await user.click(radio('Listed', 'Audited'));

    expect(radio('Verification', 'Yes').checked).toBe(true);
    expect(field('verificationDate').value).toBe('2026-09-10');
    expect(field('verificationDate')).toBeEnabled();
  });

  it('leaves Verification untouched when Listed goes to Non-Listed', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(radio('Listed', 'Non-Listed'));
    await user.click(radio('Verification', 'Yes'));
    await user.click(radio('Listed', 'Non-Listed'));

    expect(radio('Verification', 'Yes').checked).toBe(true);
    expect(field('verificationDate').value).toBe('2026-09-10');
  });

  it('stamps today when Verification is switched to Yes, and clears the date on No', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(radio('Listed', 'Non-Listed'));
    await user.click(radio('Verification', 'Yes'));
    expect(field('verificationDate').value).toBe('2026-09-10');

    await user.click(radio('Verification', 'No'));
    expect(field('verificationDate').value).toBe('');
    expect(field('verificationDate')).toBeDisabled();
  });

  it('keeps a Verification Date the user already picked instead of overwriting it with today', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(radio('Listed', 'Non-Listed'));
    await user.click(radio('Verification', 'Yes'));
    setField('verificationDate', '2026-03-01');

    await user.click(radio('Listed', 'Audited'));

    expect(field('verificationDate').value).toBe('2026-03-01');
  });
});

describe('AddAssetModal — Asset Cost thousand-separator formatting', () => {
  it.each([
    ['2499', '2,499'],
    ['1234567', '1,234,567'],
    ['1234567.89', '1,234,567.89'],
    ['1a2b3c', '123'],
    ['1.2.3', '1.23'],
    ['.5', '.5'],
    ['0012', '12'],
  ])('formats %s as %s', (typed, expected) => {
    render(<AddAssetModal />);

    setField('assetCost', typed);

    expect(field('assetCost').value).toBe(expected);
  });

  it('re-formats an already-separated value when more digits arrive', () => {
    render(<AddAssetModal />);

    setField('assetCost', '2499');
    expect(field('assetCost').value).toBe('2,499');

    setField('assetCost', '2,4990'); // as if a 0 were appended to the formatted value
    expect(field('assetCost').value).toBe('24,990');
  });

  it('clears the field when every character is deleted', () => {
    render(<AddAssetModal />);

    setField('assetCost', '500');
    setField('assetCost', '');

    expect(field('assetCost').value).toBe('');
  });
});

describe('AddAssetModal — Unlimited life checkbox', () => {
  it('locks Life in Months to the literal "Unlimited" and restores 60 when unchecked', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    const unlimited = screen.getByRole('checkbox', { name: 'Unlimited' });
    expect(field('lifeInMonths').value).toBe('60');

    await user.click(unlimited);
    expect(field('lifeInMonths').value).toBe('Unlimited');
    expect(field('lifeInMonths')).toBeDisabled();
    expect(field('lifeInMonths').type).toBe('text'); // a number input can't hold "Unlimited"

    await user.click(unlimited);
    expect(field('lifeInMonths').value).toBe('60');
    expect(field('lifeInMonths')).toBeEnabled();
    expect(field('lifeInMonths').type).toBe('number');
  });

  it('sends "Unlimited" through to addAsset', async () => {
    const user = userEvent.setup();
    mockAddAsset.mockResolvedValue(undefined);
    render(<AddAssetModal />);

    await user.click(screen.getByRole('checkbox', { name: 'Unlimited' }));
    fillRequiredFields();
    submit();

    await waitFor(() => expect(mockAddAsset).toHaveBeenCalledTimes(1));
    expect(mockAddAsset.mock.calls[0][0]).toMatchObject({ lifeInMonths: 'Unlimited' });
  });
});

describe('AddAssetModal — chrome', () => {
  it('is titled "Add New Asset" with a "Save Asset" submit button', () => {
    render(<AddAssetModal />);

    expect(screen.getByRole('heading', { name: 'Add New Asset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Asset' })).toBeInTheDocument();
  });

  it('closes without saving on Cancel', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockSetIsAddModalOpen).toHaveBeenCalledWith(false);
    expect(mockAddAsset).not.toHaveBeenCalled();
  });

  it('marks Units of Production as unavailable in the Depreciation Method group', () => {
    render(<AddAssetModal />);

    const group = screen.getByRole('radiogroup', { name: 'Depreciation Method' });
    expect(within(group).getByRole('radio', { name: /Straight Line/ })).toBeChecked();
    expect(within(group).getByRole('radio', { name: /Units of Production/ })).toBeDisabled();
  });
});

describe('AddAssetModal — typing (B6 regression)', () => {
  // Until B6 was fixed in ui/Modal, every keystroke re-ran the focus effect and moved
  // focus to the X button, so typing a space closed the modal and threw the form away.
  // These two replace the "known defect" block that pinned the broken behaviour.
  it('keeps focus in the field across keystrokes', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(field('assetNumber'));
    await user.keyboard('AST');

    expect(field('assetNumber').value).toBe('AST');
    expect(document.activeElement).toBe(field('assetNumber'));
  });

  it('accepts a space in Asset Description instead of closing the modal', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(field('assetDescription'));
    await user.keyboard('MacBook Pro M3');

    expect(field('assetDescription').value).toBe('MacBook Pro M3');
    expect(mockSetIsAddModalOpen).not.toHaveBeenCalled();
  });

  it('still formats Asset Cost while typing digit by digit', async () => {
    const user = userEvent.setup();
    render(<AddAssetModal />);

    await user.click(field('assetCost'));
    await user.keyboard('2499');

    expect(field('assetCost').value).toBe('2,499');
    expect(document.activeElement).toBe(field('assetCost'));
  });
});

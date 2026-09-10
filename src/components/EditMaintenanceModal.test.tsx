import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EditMaintenanceModal from './EditMaintenanceModal';
import type { MaintenanceRecord } from '../types/maintenance';

// Characterization tests — written before Step 7 of "refactoring v2.md" adopts
// useEntityForm here. They pin hydration from the stored row, the exact updateRecord
// payload (which today spreads the whole record, `id` included), the mount condition,
// and the labels that differ from AddMaintenanceModal.

const mockUpdateRecord = vi.fn();
const mockOnClose = vi.fn();
let mockRecords: MaintenanceRecord[] = [];

vi.mock('../contexts/MaintenanceContext', () => ({
  useMaintenance: () => ({ records: mockRecords, updateRecord: mockUpdateRecord }),
}));

const RECORD: MaintenanceRecord = {
  id: 'm1',
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
};

const scheduledDate = () => document.querySelector('input[type="date"]') as HTMLInputElement;
const statusSelect = () => screen.getByRole('combobox') as HTMLSelectElement;
const byPlaceholder = (p: string) => screen.getByPlaceholderText(p) as HTMLInputElement;

function submit() {
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRecords = [RECORD];
});

describe('EditMaintenanceModal — mount condition', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<EditMaintenanceModal isOpen={false} onClose={mockOnClose} recordId="m1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the id matches no record', () => {
    const { container } = render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="nope" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no record is selected at all', () => {
    const { container } = render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EditMaintenanceModal — chrome', () => {
  it('shows the edit title and the Save Changes button', () => {
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    expect(screen.getByRole('heading', { name: 'Edit Maintenance Record' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('shows the asset identity read-only — there is no picker here', () => {
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    expect(screen.getByText('Asset:').parentElement).toHaveTextContent('AST-001 - Excavator');
    expect(screen.getByText('Book:').parentElement).toHaveTextContent('Corporate');
    expect(screen.getByText('Subsidiary:').parentElement).toHaveTextContent('PT Raja Prima');
    expect(screen.getByText('Units:').parentElement).toHaveTextContent('1');
    expect(screen.queryByPlaceholderText('Cari asset number atau deskripsi...')).not.toBeInTheDocument();
  });

  it('closes without saving when Cancel is pressed', () => {
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  });
});

describe('EditMaintenanceModal — hydration', () => {
  it('fills every editable field from the stored record', () => {
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    expect(scheduledDate()).toHaveValue('2026-10-01');
    expect(byPlaceholder('e.g. Oil Change, Repair')).toHaveValue('Oil Change');
    expect(statusSelect()).toHaveValue('In Progress');
    expect(byPlaceholder('e.g. $500.00')).toHaveValue('$500.00');
    expect(byPlaceholder('e.g. $450.00')).toHaveValue('$450.00');
  });

  it('falls back to today and Pending when the stored row has neither', () => {
    mockRecords = [{ ...RECORD, scheduledDate: '', status: '' }];
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    expect(scheduledDate()).toHaveValue(new Date().toISOString().split('T')[0]);
    expect(statusSelect()).toHaveValue('Pending');
  });

  it('re-hydrates when a different record is selected', () => {
    mockRecords = [RECORD, { ...RECORD, id: 'm2', serviceType: 'Tyre Rotation' }];
    const { rerender } = render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    expect(byPlaceholder('e.g. Oil Change, Repair')).toHaveValue('Oil Change');

    rerender(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m2" />);
    expect(byPlaceholder('e.g. Oil Change, Repair')).toHaveValue('Tyre Rotation');
  });
});

describe('EditMaintenanceModal — save flow', () => {
  it('sends the id plus the whole record with the edited fields written over it', async () => {
    mockUpdateRecord.mockResolvedValue(undefined);
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);

    fireEvent.change(byPlaceholder('e.g. Oil Change, Repair'), { target: { value: 'Full Service' } });
    fireEvent.change(statusSelect(), { target: { value: 'Completed' } });
    submit();

    await waitFor(() => expect(mockUpdateRecord).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockUpdateRecord).toHaveBeenCalledWith('m1', {
      ...RECORD,
      serviceType: 'Full Service',
      status: 'Completed',
    });
    // Drain the 600ms minimum-delay promise so it cannot fire into the next test.
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('closes the modal after a successful save', async () => {
    mockUpdateRecord.mockResolvedValue(undefined);
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    submit();

    await waitFor(() => expect(mockOnClose).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('swaps the button for a spinner label and disables the chrome while saving', async () => {
    let release: () => void = () => {};
    mockUpdateRecord.mockImplementation(() => new Promise<void>(res => { release = () => res(); }));
    render(<EditMaintenanceModal isOpen onClose={mockOnClose} recordId="m1" />);
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();

    release();
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled(), { timeout: 3000 });
  });
});

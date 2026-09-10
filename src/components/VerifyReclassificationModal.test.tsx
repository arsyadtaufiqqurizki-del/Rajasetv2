import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VerifyReclassificationModal from './VerifyReclassificationModal';
import type { Reclassification } from '../types/reclassification';

// Written for Step 7a of "refactoring v2.md" (B1) — this modal had no test at all, and
// the step swaps its hand-rolled `fixed inset-0 z-[100]` chrome for ui/Modal. The
// behaviour that must survive: the mount condition, the toggle direction sent to
// verifyReclassification, and closing through the context pair (flag + row). The
// behaviour that is new: the dialog renders through a portal, Esc closes it, and the
// body scroll is locked while it is open.

const mockVerify = vi.fn();
const mockSetIsVerifyModalOpen = vi.fn();
const mockSetVerifyingReclassification = vi.fn();
let mockIsVerifyModalOpen = true;
let mockVerifying: Reclassification | null = null;

vi.mock('../contexts/ReclassificationContext', () => ({
  useReclassification: () => ({
    isVerifyModalOpen: mockIsVerifyModalOpen,
    setIsVerifyModalOpen: mockSetIsVerifyModalOpen,
    verifyingReclassification: mockVerifying,
    setVerifyingReclassification: mockSetVerifyingReclassification,
    verifyReclassification: mockVerify,
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
    unit: '1',
    ownership: 'Divisi Operasional',
    category: 'Needs Review',
    remarks: '',
    assetDeletedAt: null,
    verified: false,
    verificationDate: '',
    verifiedBy: '',
    createdAt: '2026-01-01',
    ...over,
  } as Reclassification;
}

const closeButton = () => screen.getAllByRole('button').find(b => b.textContent === '') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsVerifyModalOpen = true;
  mockVerifying = makeRow();
  mockVerify.mockResolvedValue(undefined);
});

describe('VerifyReclassificationModal — mount condition', () => {
  it('renders nothing while the modal flag is off', () => {
    mockIsVerifyModalOpen = false;
    render(<VerifyReclassificationModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when no row is being verified', () => {
    mockVerifying = null;
    render(<VerifyReclassificationModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('VerifyReclassificationModal — content', () => {
  it('shows the row identity read-only', () => {
    render(<VerifyReclassificationModal />);
    expect(screen.getByRole('heading', { name: 'Verifikasi Item' })).toBeInTheDocument();
    expect(screen.getByText('Kompresor GA-30')).toBeInTheDocument();
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
    expect(screen.getByText('Gudang A')).toBeInTheDocument();
    expect(screen.getByText('Divisi Operasional')).toBeInTheDocument();
  });

  it('falls back to a dash for a blank location and ownership', () => {
    mockVerifying = makeRow({ location: '', ownership: '' });
    render(<VerifyReclassificationModal />);
    expect(screen.getAllByText('-')).toHaveLength(2);
  });

  it('offers to verify an unverified row', () => {
    render(<VerifyReclassificationModal />);
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai Terverifikasi' })).toBeInTheDocument();
  });

  it('offers to un-verify a verified row, showing who verified it and when', () => {
    mockVerifying = makeRow({ verified: true, verificationDate: '2026-03-05', verifiedBy: 'Budi' });
    render(<VerifyReclassificationModal />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText(/oleh Budi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai Belum Terverifikasi' })).toBeInTheDocument();
  });
});

describe('VerifyReclassificationModal — toggle', () => {
  it('flips an unverified row to verified and then closes', async () => {
    render(<VerifyReclassificationModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Tandai Terverifikasi' }));

    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('r1', true));
    await waitFor(() => expect(mockSetIsVerifyModalOpen).toHaveBeenCalledWith(false));
    expect(mockSetVerifyingReclassification).toHaveBeenCalledWith(null);
  });

  it('flips a verified row back to unverified', async () => {
    mockVerifying = makeRow({ verified: true });
    render(<VerifyReclassificationModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Tandai Belum Terverifikasi' }));

    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('r1', false));
  });

  it('disables both buttons while the toggle is in flight', async () => {
    let release!: () => void;
    mockVerify.mockReturnValue(new Promise<void>(r => { release = r; }));
    render(<VerifyReclassificationModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Tandai Terverifikasi' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Tandai Terverifikasi' })).toBeDisabled();

    release();
    await waitFor(() => expect(mockSetIsVerifyModalOpen).toHaveBeenCalledWith(false));
  });
});

// Step 7a (B1) — the three close paths and the chrome ui/Modal brings with it.
describe('VerifyReclassificationModal — ui/Modal chrome', () => {
  it('labels the dialog with the heading it renders', () => {
    render(<VerifyReclassificationModal />);
    const heading = screen.getByRole('heading', { name: 'Verifikasi Item' });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('clears both the flag and the row when Batal is pressed', () => {
    render(<VerifyReclassificationModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(mockSetIsVerifyModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetVerifyingReclassification).toHaveBeenCalledWith(null);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('clears both the flag and the row when the header X button is pressed', () => {
    render(<VerifyReclassificationModal />);
    fireEvent.click(closeButton());
    expect(mockSetIsVerifyModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetVerifyingReclassification).toHaveBeenCalledWith(null);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('clears both the flag and the row when Esc is pressed', () => {
    render(<VerifyReclassificationModal />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetIsVerifyModalOpen).toHaveBeenCalledWith(false);
    expect(mockSetVerifyingReclassification).toHaveBeenCalledWith(null);
  });

  it('ignores Esc while the toggle is in flight', async () => {
    let release!: () => void;
    mockVerify.mockReturnValue(new Promise<void>(r => { release = r; }));
    render(<VerifyReclassificationModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Tandai Terverifikasi' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockSetIsVerifyModalOpen).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(mockSetIsVerifyModalOpen).toHaveBeenCalledWith(false));
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(<VerifyReclassificationModal />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

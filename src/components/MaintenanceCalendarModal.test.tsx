import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MaintenanceCalendarModal from './MaintenanceCalendarModal';
import type { MaintenanceRecord } from '../contexts/MaintenanceContext';

// Written for Step 7a of "refactoring v2.md" (B1) — this modal had no test at all, and
// the step swaps its hand-rolled `fixed inset-0` chrome for ui/Modal. What must survive:
// the month grid, which days are clickable, the per-day record list with its pagination,
// picking a record, and the reset-on-close of the internal selection. What is new: the
// portal, Esc, the focus trap and the body scroll lock.
//
// The clock is frozen so "today" and the rendered month never drift with the calendar.

const mockOnClose = vi.fn();
const mockOnSelectRecord = vi.fn();

function makeRecord(over: Partial<MaintenanceRecord> & { id: string }): MaintenanceRecord {
  return {
    assetId: 'a1',
    assetNumber: 'AST-001',
    assetDescription: 'Excavator',
    assetBook: 'Corporate',
    subsidiary: 'PT Raja Prima',
    assetUnits: '1',
    scheduledDate: '2026-03-10',
    serviceType: 'Oil Change',
    status: 'Pending',
    estimateCost: '',
    actualCost: '',
    createdAt: '2026-03-01',
    ...over,
  } as MaintenanceRecord;
}

const closeButton = () => screen.getAllByRole('button').find(b => b.textContent === '') as HTMLElement;
// The 42-cell grid spills into the neighbouring months, so a day number can appear
// twice. The out-of-month copy is the one dimmed with opacity-40.
const dayButton = (day: string) =>
  screen
    .getAllByText(day)
    .map(el => el.closest('button'))
    .find(b => b && !b.className.includes('opacity-40')) as HTMLElement;

function renderModal(records: MaintenanceRecord[] = [makeRecord({ id: 'm1' })]) {
  return render(
    <MaintenanceCalendarModal
      isOpen
      onClose={mockOnClose}
      records={records}
      onSelectRecord={mockOnSelectRecord}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 2, 15)); // 15 March 2026
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MaintenanceCalendarModal — mount condition', () => {
  it('renders nothing while closed', () => {
    render(
      <MaintenanceCalendarModal
        isOpen={false}
        onClose={mockOnClose}
        records={[makeRecord({ id: 'm1' })]}
        onSelectRecord={mockOnSelectRecord}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('MaintenanceCalendarModal — month grid', () => {
  it('opens on the current month with the weekday header', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'March 2026' })).toBeInTheDocument();
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('steps back and forward a month, and returns with Today', () => {
    renderModal();
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getByRole('heading', { name: 'February 2026' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next month'));
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByRole('heading', { name: 'April 2026' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('heading', { name: 'March 2026' })).toBeInTheDocument();
  });

  it('only enables days that carry a scheduled record', () => {
    renderModal();
    expect(dayButton('10')).toBeEnabled();
    expect(dayButton('11')).toBeDisabled();
  });

  it('ignores records with a blank or unparseable scheduled date', () => {
    renderModal([
      makeRecord({ id: 'm1', scheduledDate: '' }),
      makeRecord({ id: 'm2', scheduledDate: 'not-a-date' }),
    ]);
    expect(dayButton('10')).toBeDisabled();
  });
});

describe('MaintenanceCalendarModal — day detail', () => {
  it('lists the records of the clicked day and hides them again on a second click', () => {
    renderModal();
    fireEvent.click(dayButton('10'));
    expect(screen.getByText('Oil Change')).toBeInTheDocument();

    fireEvent.click(dayButton('10'));
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
  });

  it('hands the picked record back and closes', () => {
    renderModal();
    fireEvent.click(dayButton('10'));
    fireEvent.click(screen.getByText('Oil Change').closest('button') as HTMLElement);

    expect(mockOnSelectRecord).toHaveBeenCalledWith('m1');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('paginates a day with more than five records, five at a time', () => {
    const records = Array.from({ length: 7 }, (_, i) =>
      makeRecord({ id: `m${i}`, serviceType: `Service ${i}` })
    );
    renderModal(records);
    fireEvent.click(dayButton('10'));

    expect(screen.getByText('Showing 5 of 7 entries')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Service 0')).toBeInTheDocument();
    expect(screen.queryByText('Service 5')).not.toBeInTheDocument();
  });

  it('drops the day selection when the month changes', () => {
    renderModal();
    fireEvent.click(dayButton('10'));
    expect(screen.getByText('Oil Change')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
  });
});

// Step 7a (B1) — the chrome ui/Modal brings with it. The X button already existed;
// Esc, the portal and the scroll lock are new.
describe('MaintenanceCalendarModal — ui/Modal chrome', () => {
  it('labels the dialog with the heading it renders', () => {
    renderModal();
    const heading = screen.getByRole('heading', { name: 'Maintenance Calendar' });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('keeps the panel wide enough for the month grid', () => {
    renderModal();
    expect(screen.getByRole('dialog').className).toContain('max-w-3xl');
  });

  it('closes when the header X button is pressed', () => {
    renderModal();
    fireEvent.click(closeButton());
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnSelectRecord).not.toHaveBeenCalled();
  });

  it('closes when Esc is pressed', () => {
    renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('forgets the picked day between closing and reopening', () => {
    const { rerender } = renderModal();
    fireEvent.click(dayButton('10'));
    expect(screen.getByText('Oil Change')).toBeInTheDocument();

    fireEvent.click(closeButton());
    rerender(
      <MaintenanceCalendarModal
        isOpen={false}
        onClose={mockOnClose}
        records={[makeRecord({ id: 'm1' })]}
        onSelectRecord={mockOnSelectRecord}
      />
    );
    rerender(
      <MaintenanceCalendarModal
        isOpen
        onClose={mockOnClose}
        records={[makeRecord({ id: 'm1' })]}
        onSelectRecord={mockOnSelectRecord}
      />
    );
    expect(screen.queryByText('Oil Change')).not.toBeInTheDocument();
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('keeps the day grid inside the dialog', () => {
    renderModal();
    expect(within(screen.getByRole('dialog')).getByText('Maintenance Calendar')).toBeInTheDocument();
  });
});

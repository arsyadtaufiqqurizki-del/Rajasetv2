import { useState } from 'react';
import FormModal from './ui/FormModal';

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'] as const;
const TITLE_ID = 'maintenance-bulk-status-title';

interface MaintenanceBulkStatusModalProps {
  isOpen: boolean;
  selectedCount: number;
  initialStatus?: string;
  isSaving?: boolean;
  onCancel: () => void;
  onConfirm: (status: string) => void;
}

export default function MaintenanceBulkStatusModal({
  isOpen,
  selectedCount,
  initialStatus = 'Completed',
  isSaving = false,
  onCancel,
  onConfirm,
}: MaintenanceBulkStatusModalProps) {
  const [status, setStatus] = useState(initialStatus);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setStatus(initialStatus);
  }

  return (
    <FormModal
      isOpen={isOpen}
      titleId={TITLE_ID}
      title="Update Status"
      onClose={onCancel}
      onSubmit={e => {
        e.preventDefault();
        onConfirm(status);
      }}
      submitLabel="Apply"
      savingLabel="Updating..."
      isSaving={isSaving}
      className="max-w-md max-h-[90vh] flex flex-col"
    >
      <p className="text-sm text-on-surface-variant">
        <strong className="text-on-surface">{selectedCount}</strong> record{selectedCount === 1 ? '' : 's'} will be changed to{' '}
        <strong className="text-on-surface">“{status}”</strong>. Continue?
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-on-surface">Target status</span>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
    </FormModal>
  );
}

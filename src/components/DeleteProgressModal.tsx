import ProgressModal from './ui/ProgressModal';

export interface DeleteProgressState {
  isOpen: boolean;
  status: 'deleting' | 'done';
  total: number;
  processed: number;
  failedCount: number;
}

interface DeleteProgressModalProps {
  deleteProgressModal: DeleteProgressState;
  onClose: () => void;
  /** plural noun for the items being deleted, e.g. "assets" or "reclassification items" */
  itemLabel?: string;
}

export default function DeleteProgressModal({ deleteProgressModal, onClose, itemLabel = 'assets' }: DeleteProgressModalProps) {
  const { isOpen, status, total, processed, failedCount } = deleteProgressModal;
  const label = itemLabel.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <ProgressModal
      isOpen={isOpen}
      status={status === 'deleting' ? 'busy' : 'done'}
      busyTitle={`Deleting ${label}...`}
      busyDescription={`Please wait while the selected ${itemLabel} are being deleted.`}
      total={total}
      processed={processed}
      unit={`${itemLabel} deleted`}
      doneTitle="Delete Complete"
      hasWarning={failedCount > 0}
      stats={[
        { label: 'Successfully deleted', value: `${processed - failedCount} ${itemLabel}`, tone: 'success' },
        ...(failedCount > 0 ? [{ label: 'Failed', value: `${failedCount} ${itemLabel}`, tone: 'error' as const }] : []),
      ]}
      onClose={onClose}
    />
  );
}

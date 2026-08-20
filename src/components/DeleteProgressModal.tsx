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
}

export default function DeleteProgressModal({ deleteProgressModal, onClose }: DeleteProgressModalProps) {
  const { isOpen, status, total, processed, failedCount } = deleteProgressModal;

  return (
    <ProgressModal
      isOpen={isOpen}
      status={status === 'deleting' ? 'busy' : 'done'}
      busyTitle="Deleting Assets..."
      busyDescription="Please wait while the selected assets are being deleted."
      total={total}
      processed={processed}
      unit="assets deleted"
      doneTitle="Delete Complete"
      hasWarning={failedCount > 0}
      stats={[
        { label: 'Successfully deleted', value: `${processed - failedCount} assets`, tone: 'success' },
        ...(failedCount > 0 ? [{ label: 'Failed', value: `${failedCount} assets`, tone: 'error' as const }] : []),
      ]}
      onClose={onClose}
    />
  );
}

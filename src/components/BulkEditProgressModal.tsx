import ProgressModal from './ui/ProgressModal';

export interface BulkEditProgressState {
  isOpen: boolean;
  status: 'updating' | 'done';
  total: number;
  processed: number;
  failedCount: number;
}

interface BulkEditProgressModalProps {
  bulkEditProgress: BulkEditProgressState;
  onClose: () => void;
}

export default function BulkEditProgressModal({ bulkEditProgress, onClose }: BulkEditProgressModalProps) {
  const { isOpen, status, total, processed, failedCount } = bulkEditProgress;

  return (
    <ProgressModal
      isOpen={isOpen}
      status={status === 'updating' ? 'busy' : 'done'}
      busyTitle="Updating Assets..."
      busyDescription="Please wait while the selected assets are being updated."
      total={total}
      processed={processed}
      unit="assets updated"
      doneTitle="Bulk Edit Complete"
      hasWarning={failedCount > 0}
      stats={[
        { label: 'Successfully updated', value: `${processed - failedCount} assets`, tone: 'success' },
        ...(failedCount > 0 ? [{ label: 'Failed', value: `${failedCount} assets`, tone: 'error' as const }] : []),
      ]}
      onClose={onClose}
    />
  );
}

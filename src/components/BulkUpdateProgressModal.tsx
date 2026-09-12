import ProgressModal from './ui/ProgressModal';

export interface BulkUpdateProgressState {
  isOpen: boolean;
  status: 'updating' | 'done';
  total: number;
  processed: number;
  failedCount: number;
}

interface BulkUpdateProgressModalProps {
  progress: BulkUpdateProgressState;
  onClose: () => void;
  itemLabel?: string;
}

export default function BulkUpdateProgressModal({ progress, onClose, itemLabel = 'records' }: BulkUpdateProgressModalProps) {
  const { isOpen, status, total, processed, failedCount } = progress;
  const label = itemLabel.replace(/\b\w/g, c => c.toUpperCase());

  return (
    <ProgressModal
      isOpen={isOpen}
      status={status === 'updating' ? 'busy' : 'done'}
      busyTitle={`Updating ${label}...`}
      busyDescription={`Please wait while the selected ${itemLabel} are being updated.`}
      total={total}
      processed={processed}
      unit={`${itemLabel} updated`}
      doneTitle="Bulk Update Complete"
      hasWarning={failedCount > 0}
      stats={[
        { label: 'Successfully updated', value: `${processed - failedCount} ${itemLabel}`, tone: 'success' },
        ...(failedCount > 0 ? [{ label: 'Failed', value: `${failedCount} ${itemLabel}`, tone: 'error' as const }] : []),
      ]}
      onClose={onClose}
    />
  );
}

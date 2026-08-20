import { FileDown } from 'lucide-react';
import ProgressModal from './ui/ProgressModal';

export interface InvalidRow {
  rowNumber: number;
  assetNumber: string;
  assetDescription: string;
  reason: string;
}

export interface ImportModalState {
  isOpen: boolean;
  status: 'importing' | 'done';
  total: number;
  processed: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  invalidRows: InvalidRow[];
}

interface ImportProgressModalProps {
  importModal: ImportModalState;
  onClose: () => void;
  onDownloadInvalidRows: () => void;
}

export default function ImportProgressModal({ importModal, onClose, onDownloadInvalidRows }: ImportProgressModalProps) {
  const { isOpen, status, total, processed, successCount, failedCount, skippedCount, invalidRows } = importModal;

  return (
    <ProgressModal
      isOpen={isOpen}
      status={status === 'importing' ? 'busy' : 'done'}
      busyTitle="Importing Assets..."
      busyDescription="Please wait while your CSV file is being processed."
      total={total}
      processed={processed}
      unit="assets processed"
      doneTitle="Import Complete"
      hasWarning={failedCount > 0}
      stats={[
        { label: 'Successfully imported', value: `${successCount} assets`, tone: 'success' },
        ...(failedCount > 0 ? [{ label: 'Failed', value: `${failedCount} assets`, tone: 'error' as const }] : []),
        ...(skippedCount > 0 ? [{ label: 'Skipped (invalid rows)', value: `${skippedCount} rows`, tone: 'warning' as const }] : []),
      ]}
      onClose={onClose}
    >
      {invalidRows.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Baris yang dilewati
            </span>
            <button
              onClick={onDownloadInvalidRows}
              className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <FileDown className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-outline-variant text-xs">
            <table className="w-full">
              <thead className="bg-surface-container sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Baris</th>
                  <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Asset Number</th>
                  <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {invalidRows.map((row, i) => (
                  <tr key={i} className="border-t border-outline-variant/50">
                    <td className="px-3 py-1.5 text-on-surface-variant">{row.rowNumber}</td>
                    <td className="px-3 py-1.5 text-on-surface">{row.assetNumber || <span className="italic text-on-surface-variant">—</span>}</td>
                    <td className="px-3 py-1.5 text-amber-600">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ProgressModal>
  );
}

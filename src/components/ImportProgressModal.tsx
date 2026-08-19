import { CheckCircle, FileDown, Loader2, XCircle } from 'lucide-react';

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
  if (!importModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {importModal.status === 'importing' ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                <h3 className="text-xl font-bold text-on-surface">Importing Assets...</h3>
              </div>
              <p className="text-sm text-on-surface-variant mb-5">
                Please wait while your CSV file is being processed.
              </p>
              <div className="mb-2 h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importModal.total > 0 ? Math.round((importModal.processed / importModal.total) * 100) : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
                <span>{importModal.processed} of {importModal.total} assets processed</span>
                <span className="font-semibold text-primary">
                  {importModal.total > 0 ? Math.round((importModal.processed / importModal.total) * 100) : 0}%
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                {importModal.failedCount === 0 ? (
                  <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
                )}
                <h3 className="text-xl font-bold text-on-surface">Import Complete</h3>
              </div>
              <div className="bg-surface-container rounded-xl p-4 mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Successfully imported</span>
                  <span className="font-semibold text-emerald-600">{importModal.successCount} assets</span>
                </div>
                {importModal.failedCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Failed</span>
                    <span className="font-semibold text-error">{importModal.failedCount} assets</span>
                  </div>
                )}
                {importModal.skippedCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Skipped (invalid rows)</span>
                    <span className="font-semibold text-amber-600">{importModal.skippedCount} rows</span>
                  </div>
                )}
              </div>

              {importModal.invalidRows.length > 0 && (
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
                        {importModal.invalidRows.map((row, i) => (
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

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 font-medium text-sm transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

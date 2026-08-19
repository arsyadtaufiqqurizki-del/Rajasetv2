import { CheckCircle, Loader2, XCircle } from 'lucide-react';

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
  if (!deleteProgressModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {deleteProgressModal.status === 'deleting' ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                <h3 className="text-xl font-bold text-on-surface">Deleting Assets...</h3>
              </div>
              <p className="text-sm text-on-surface-variant mb-5">
                Please wait while the selected assets are being deleted.
              </p>
              <div className="mb-2 h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${deleteProgressModal.total > 0 ? Math.round((deleteProgressModal.processed / deleteProgressModal.total) * 100) : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
                <span>{deleteProgressModal.processed} of {deleteProgressModal.total} assets deleted</span>
                <span className="font-semibold text-primary">
                  {deleteProgressModal.total > 0 ? Math.round((deleteProgressModal.processed / deleteProgressModal.total) * 100) : 0}%
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                {deleteProgressModal.failedCount === 0 ? (
                  <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
                )}
                <h3 className="text-xl font-bold text-on-surface">Delete Complete</h3>
              </div>
              <div className="bg-surface-container rounded-xl p-4 mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Successfully deleted</span>
                  <span className="font-semibold text-emerald-600">{deleteProgressModal.processed - deleteProgressModal.failedCount} assets</span>
                </div>
                {deleteProgressModal.failedCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Failed</span>
                    <span className="font-semibold text-error">{deleteProgressModal.failedCount} assets</span>
                  </div>
                )}
              </div>
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

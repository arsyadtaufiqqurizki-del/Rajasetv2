import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import Modal from './Modal';

export interface ProgressModalStat {
  label: string;
  value: string;
  tone?: 'success' | 'error' | 'warning';
}

interface ProgressModalProps {
  isOpen: boolean;
  status: 'busy' | 'done';
  busyTitle: string;
  busyDescription: string;
  total: number;
  processed: number;
  /** appended after "{processed} of {total}" on the progress row, e.g. "assets deleted" */
  unit: string;
  doneTitle: string;
  /** shows the warning icon instead of the success one in the done state */
  hasWarning?: boolean;
  stats: ProgressModalStat[];
  onClose: () => void;
  /** extra content rendered between the stats block and the Close button in the done state */
  children?: React.ReactNode;
}

const TITLE_ID = 'progress-modal-title';

const TONE_CLASS: Record<NonNullable<ProgressModalStat['tone']>, string> = {
  success: 'text-emerald-600',
  error: 'text-error',
  warning: 'text-amber-600',
};

export default function ProgressModal({
  isOpen,
  status,
  busyTitle,
  busyDescription,
  total,
  processed,
  unit,
  doneTitle,
  hasWarning = false,
  stats,
  onClose,
  children,
}: ProgressModalProps) {
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy={TITLE_ID} closeOnEscape={status === 'done'}>
      <div className="p-6">
        {status === 'busy' ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              <h3 id={TITLE_ID} className="text-xl font-bold text-on-surface">
                {busyTitle}
              </h3>
            </div>
            <p className="text-sm text-on-surface-variant mb-5">{busyDescription}</p>
            <div className="mb-2 h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
              <span>
                {processed} of {total} {unit}
              </span>
              <span className="font-semibold text-primary">{percent}%</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              {hasWarning ? (
                <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
              )}
              <h3 id={TITLE_ID} className="text-xl font-bold text-on-surface">
                {doneTitle}
              </h3>
            </div>
            {stats.length > 0 && (
              <div className="bg-surface-container rounded-xl p-4 mb-4 space-y-2 text-sm">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex justify-between">
                    <span className="text-on-surface-variant">{stat.label}</span>
                    <span className={cn('font-semibold', stat.tone ? TONE_CLASS[stat.tone] : 'text-on-surface')}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {children}
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
    </Modal>
  );
}

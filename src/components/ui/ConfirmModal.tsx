import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** disables both buttons and swaps confirmLabel for a spinner + confirmingLabel, e.g. while an async delete is in flight */
  isConfirming?: boolean;
  confirmingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const TITLE_ID = 'confirm-modal-title';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isConfirming = false,
  confirmingLabel = 'Processing...',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} labelledBy={TITLE_ID} closeOnEscape={!isConfirming}>
      <div className="p-6">
        <h3 id={TITLE_ID} className="text-xl font-bold text-on-surface mb-2">
          {title}
        </h3>
        <p className="text-on-surface-variant mb-6 text-sm">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={cn(
              'px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]',
              destructive ? 'bg-error text-on-error hover:bg-error/90' : 'bg-primary text-on-primary hover:bg-primary/90'
            )}
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {confirmingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

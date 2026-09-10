import React from 'react';
import { Loader2, X } from 'lucide-react';
import Modal from './Modal';

interface FormModalProps {
  isOpen: boolean;
  /** id of the heading element, wired to aria-labelledby on the dialog */
  titleId: string;
  title: string;
  /** called by the X button, the Cancel button and Esc — the caller decides whether to ignore it while saving */
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  /** the form body; the error banner and the footer are rendered after it, inside the same <form> */
  children: React.ReactNode;
  submitLabel: string;
  cancelLabel?: string;
  /** disables the chrome, blocks Esc, and swaps submitLabel for a spinner + savingLabel */
  isSaving?: boolean;
  savingLabel?: string;
  /** banner shown between the fields and the footer; nothing is rendered when null */
  error?: string | null;
  /** additional classes for the dialog panel */
  className?: string;
}

export default function FormModal({
  isOpen,
  titleId,
  title,
  onClose,
  onSubmit,
  children,
  submitLabel,
  cancelLabel = 'Cancel',
  isSaving = false,
  savingLabel = 'Saving...',
  error = null,
  className = 'max-w-2xl max-h-[90vh] flex flex-col',
}: FormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      closeOnEscape={!isSaving}
      className={className}
    >
      <div className="flex items-center justify-between p-6 border-b border-outline-variant/30 shrink-0">
        <h2 id={titleId} className="text-xl font-bold text-on-surface">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {children}

        {error && (
          <p className="text-sm text-error bg-error-container/20 border border-error/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {savingLabel}
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

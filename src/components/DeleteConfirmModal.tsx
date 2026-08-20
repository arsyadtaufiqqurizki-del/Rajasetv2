import Modal from './ui/Modal';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  selectedCount: number;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const TITLE_ID = 'delete-confirm-modal-title';

export default function DeleteConfirmModal({
  isOpen,
  selectedCount,
  confirmText,
  onConfirmTextChange,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} labelledBy={TITLE_ID}>
      <div className="p-6">
        <h3 id={TITLE_ID} className="text-xl font-bold text-on-surface mb-2">Delete Multiple Assets</h3>
        <p className="text-on-surface-variant mb-4 text-sm">
          You are about to delete <strong>{selectedCount}</strong> assets. This action is irreversible.
          Please type <strong>DELETE</strong> below to confirm.
        </p>

        <input
          type="text"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="w-full bg-surface border border-outline-variant rounded-md text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-error focus:border-transparent text-on-surface mb-6"
        />

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmText !== 'DELETE'}
            className="px-4 py-2 bg-error text-on-error rounded-md hover:bg-error/90 font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Yes, Delete All
          </button>
        </div>
      </div>
    </Modal>
  );
}

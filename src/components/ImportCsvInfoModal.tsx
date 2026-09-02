import { AlertTriangle, Upload } from 'lucide-react';
import Modal from './ui/Modal';

interface ImportCsvInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const TITLE_ID = 'import-csv-info-modal-title';

export default function ImportCsvInfoModal({ isOpen, onClose, onConfirm }: ImportCsvInfoModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy={TITLE_ID} className="max-w-md">
      <div className="flex flex-col">
        <div className="flex items-center gap-3 p-6 border-b border-outline-variant/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 id={TITLE_ID} className="text-xl font-bold text-on-surface">
            Import Asset CSV
          </h2>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-on-surface-variant">
            The CSV file you upload must match the Asset Import Template exactly — same column headers, in the same
            format. If the file doesn't match the template, rows with missing required fields (Asset Number, Asset
            Description) will fail to import.
          </p>
          <p className="text-sm text-on-surface-variant">
            Not sure your file matches? Use <span className="font-medium text-on-surface">Download Template</span>{' '}
            first to get the correct format.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-outline-variant/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:opacity-90 font-medium text-sm transition-opacity shadow-sm"
          >
            <Upload className="h-4 w-4" />
            Choose File
          </button>
        </div>
      </div>
    </Modal>
  );
}

import { Download, X } from 'lucide-react';
import Modal from './ui/Modal';

interface DownloadTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TITLE_ID = 'download-template-modal-title';

const COLUMN_NOTES: { column: string; description: string }[] = [
  { column: 'Asset Number', description: 'Unique identifier for the asset.' },
  { column: 'Asset Description', description: 'Short name or description of the asset.' },
  { column: 'Asset Book', description: 'Depreciation book the asset belongs to.' },
  { column: 'Subsidiary', description: 'Owning subsidiary or entity.' },
  { column: 'Asset Cost', description: 'Original acquisition cost of the asset.' },
  { column: 'Date Place In Service', description: 'Date the asset was placed in service (YYYY-MM-DD).' },
  { column: 'Asset Units', description: 'Number of units for this asset line.' },
  { column: 'Asset Category Segment 1', description: 'Fill in with the Asset Class (e.g. "FA Vehicles", "FA Land").' },
  { column: 'Asset Category Segment 2', description: 'Fill in with the Location (e.g. "Jakarta HQ", "Kantor Cabang Bandung").' },
  { column: 'Depreciation Method', description: 'Depreciation method, e.g. "Straight Line".' },
  { column: 'Life in Months', description: 'Useful life in months, or "Unlimited".' },
  { column: 'Listed', description: '"Yes" or "No" — whether the asset is listed.' },
  { column: 'Status', description: 'Current asset status, e.g. "Active".' },
  { column: 'Verification', description: '"Yes" or "No" — whether the asset has been verified.' },
  { column: 'Verification Date', description: 'Date of verification (YYYY-MM-DD), if verified.' },
  { column: 'Item Status', description: 'e.g. "Asset", "Inventory", or "Needs Review".' },
];

export default function DownloadTemplateModal({ isOpen, onClose }: DownloadTemplateModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy={TITLE_ID} className="max-w-2xl">
      <div className="flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 id={TITLE_ID} className="text-xl font-bold text-on-surface">
            Asset Import Template
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-on-surface-variant">
            The template contains the columns below. Column headers must not be renamed when you fill in the file.
          </p>
          <div className="overflow-x-auto rounded-lg border border-outline-variant/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-medium text-on-surface-variant bg-surface-container-low">
                  <th className="py-2 px-3 text-left">Column</th>
                  <th className="py-2 px-3 text-left">What to fill in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {COLUMN_NOTES.map((row) => (
                  <tr key={row.column}>
                    <td className="py-2 px-3 font-medium text-on-surface whitespace-nowrap">{row.column}</td>
                    <td className="py-2 px-3 text-on-surface-variant">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-outline-variant/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <a
            href="/asset_import_template.csv"
            download="asset_import_template.csv"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:opacity-90 font-medium text-sm transition-opacity shadow-sm"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </Modal>
  );
}

import { Download, Table2 } from 'lucide-react';

interface ExportPanelProps {
  disabled: boolean;
  exportingPdf: boolean;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export default function ExportPanel({ disabled, exportingPdf, onExportPdf, onExportExcel }: ExportPanelProps) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-on-surface mb-4">Export Options</h3>
      <div className="flex flex-col gap-3">
        <button
          onClick={onExportPdf}
          type="button"
          disabled={disabled || exportingPdf}
          className="bg-[#0F172A] text-white font-medium text-sm py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed w-full flex justify-center items-center gap-2 shadow-sm"
        >
          <Download className="h-4 w-4" /> {exportingPdf ? 'Rendering chart...' : 'Download as PDF'}
        </button>
        <button
          onClick={onExportExcel}
          type="button"
          disabled={disabled}
          className="bg-surface-container-lowest border border-outline text-primary font-medium text-sm py-2.5 px-4 rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full flex justify-center items-center gap-2"
        >
          <Table2 className="h-4 w-4" /> Export to Excel (.xlsx)
        </button>
      </div>
    </div>
  );
}

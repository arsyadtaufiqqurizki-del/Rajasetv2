import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, Download, FileDown, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { cn } from '../lib/utils';

interface AssetToolbarProps {
  onImportCSV: (event: ChangeEvent<HTMLInputElement>) => void;
  isImporting: boolean;
  onAddNew: () => void;
  selectedCount: number;
  onDeleteSelectedClick: () => void;
  filteredCount: number;
  isExporting: boolean;
  onExport: (scope: 'all' | 'selected') => void;
}

export default function AssetToolbar({
  onImportCSV,
  isImporting,
  onAddNew,
  selectedCount,
  onDeleteSelectedClick,
  filteredCount,
  isExporting,
  onExport,
}: AssetToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        className="hidden"
        onChange={onImportCSV}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="h-4 w-4" />
        Import CSV
      </button>
      <a
        href="/asset_import_template.csv"
        download="asset_import_template.csv"
        className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm"
      >
        <FileDown className="h-4 w-4" />
        Download Template
      </a>
      <div ref={exportMenuRef} className="relative">
        <button
          onClick={() => setIsExportMenuOpen(prev => !prev)}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export
          <ChevronDown className="h-4 w-4" />
        </button>

        {isExportMenuOpen && (
          <ul className="absolute z-50 mt-1 min-w-full w-max right-0 overflow-hidden rounded-md bg-surface border border-outline-variant py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <li
              onClick={() => { setIsExportMenuOpen(false); onExport('all'); }}
              className="flex items-center justify-between gap-4 cursor-pointer select-none py-2 px-3 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <span>Export All (Filtered)</span>
              <span className="text-on-surface-variant text-xs">{filteredCount}</span>
            </li>
            <li
              onClick={() => { if (selectedCount > 0) { setIsExportMenuOpen(false); onExport('selected'); } }}
              className={cn(
                "flex items-center justify-between gap-4 select-none py-2 px-3 text-sm transition-colors",
                selectedCount > 0
                  ? "cursor-pointer text-on-surface hover:bg-surface-container-low"
                  : "cursor-not-allowed text-on-surface-variant opacity-50"
              )}
            >
              <span>Export Selected</span>
              <span className="text-on-surface-variant text-xs">{selectedCount}</span>
            </li>
          </ul>
        )}
      </div>
      <button
        onClick={onAddNew}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:opacity-90 font-medium text-sm transition-opacity shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Add New Asset
      </button>
      {selectedCount > 0 && (
        <button
          onClick={onDeleteSelectedClick}
          className="flex items-center gap-2 px-4 py-2 bg-error text-on-error rounded-md hover:bg-error/90 font-medium text-sm transition-colors shadow-sm"
        >
          <Trash2 className="h-4 w-4" />
          Delete Selected ({selectedCount})
        </button>
      )}
    </div>
  );
}

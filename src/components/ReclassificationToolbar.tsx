import { Plus, Trash2, Download, RefreshCw } from 'lucide-react';

interface ReclassificationToolbarProps {
  onSyncFromAssets: () => void;
  isSyncing: boolean;
  onExport: () => void;
  onAddNew: () => void;
  selectedCount: number;
  onDeleteSelectedClick: () => void;
}

export default function ReclassificationToolbar({
  onSyncFromAssets,
  isSyncing,
  onExport,
  onAddNew,
  selectedCount,
  onDeleteSelectedClick,
}: ReclassificationToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onSyncFromAssets}
        disabled={isSyncing}
        className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title="Tambahkan asset dari Inventory yang belum tertaut sebagai baseline audit"
      >
        <RefreshCw className="h-4 w-4" />
        Sync from Assets
      </button>
      <button
        onClick={onExport}
        className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </button>
      <button
        onClick={onAddNew}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 font-medium text-sm transition-colors shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Tambah Item
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

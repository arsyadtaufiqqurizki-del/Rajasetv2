import { useState } from 'react';
import { Trash2, X, Check } from 'lucide-react';

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'] as const;

interface MaintenanceBulkBarProps {
  selectedCount: number;
  onDelete: () => void;
  onBulkStatus: (status: string) => void;
  onClear: () => void;
}

export default function MaintenanceBulkBar({ selectedCount, onDelete, onBulkStatus, onClear }: MaintenanceBulkBarProps) {
  const [markStatus, setMarkStatus] = useState<string>(STATUSES[0]);

  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
      <span className="text-sm font-medium text-on-surface">
        {selectedCount} record{selectedCount === 1 ? '' : 's'} selected
      </span>
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        <select
          value={markStatus}
          onChange={e => setMarkStatus(e.target.value)}
          aria-label="Bulk status target"
          className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none cursor-pointer"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onBulkStatus(markStatus)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:opacity-90 transition-opacity"
        >
          <Check className="h-3.5 w-3.5" /> Mark as {markStatus}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-lg border border-error/30 px-3 py-1.5 text-xs font-medium text-error hover:bg-error-container/40 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete Selected
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}

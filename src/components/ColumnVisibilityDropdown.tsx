import { useEffect, useRef, useState } from 'react';
import { Columns3, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AssetColumnDef } from './AssetTable';

interface ColumnVisibilityDropdownProps {
  columns: AssetColumnDef[];
  visibleColumns: Set<string>;
  onToggleColumn: (columnId: string) => void;
  onShowAll: () => void;
}

export default function ColumnVisibilityDropdown({
  columns,
  visibleColumns,
  onToggleColumn,
  onShowAll,
}: ColumnVisibilityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hiddenCount = columns.length - visibleColumns.size;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm"
      >
        <Columns3 className="h-4 w-4" />
        Columns
        {hiddenCount > 0 && (
          <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-semibold">
            {hiddenCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[220px] w-max right-0 overflow-hidden rounded-md bg-surface border border-outline-variant shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="flex items-center justify-between gap-4 py-2 px-3 border-b border-outline-variant">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Show/Hide Columns</span>
            <button
              type="button"
              onClick={onShowAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              Show All
            </button>
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            {columns.map((col) => {
              const isVisible = visibleColumns.has(col.id);
              const isLastVisible = isVisible && visibleColumns.size === 1;
              return (
                <li
                  key={col.id}
                  onClick={() => { if (!isLastVisible) onToggleColumn(col.id); }}
                  className={cn(
                    "flex items-center gap-2 select-none py-2 px-3 text-sm text-on-surface transition-colors",
                    isLastVisible ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-container-low"
                  )}
                >
                  <span className={cn(
                    "flex items-center justify-center h-4 w-4 rounded border shrink-0",
                    isVisible ? "bg-primary border-primary text-on-primary" : "border-outline-variant"
                  )}>
                    {isVisible && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{col.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

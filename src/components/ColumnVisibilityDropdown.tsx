import { useEffect, useRef, useState, useId, type KeyboardEvent } from 'react';
import { Columns3, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useListNav } from '../hooks/useListNav';
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
  const listId = useId();

  const close = () => setIsOpen(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hiddenCount = columns.length - visibleColumns.size;

  const handleSelect = (index: number) => {
    const col = columns[index];
    const isVisible = visibleColumns.has(col.id);
    const isLastVisible = isVisible && visibleColumns.size === 1;
    if (!isLastVisible) onToggleColumn(col.id);
  };

  const { activeIndex, setActiveIndex, handleKeyDown, reset } = useListNav(columns.length, handleSelect, close);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const optionId = (index: number) => `${listId}-option-${index}`;

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    handleKeyDown(e);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
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
          <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-72 overflow-auto py-1">
            {columns.map((col, index) => {
              const isVisible = visibleColumns.has(col.id);
              const isLastVisible = isVisible && visibleColumns.size === 1;
              return (
                <li
                  key={col.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isVisible}
                  aria-disabled={isLastVisible}
                  onClick={() => { if (!isLastVisible) onToggleColumn(col.id); }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex items-center gap-2 select-none py-2 px-3 text-sm text-on-surface transition-colors",
                    isLastVisible ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    !isLastVisible && index === activeIndex ? "bg-surface-container-low" : !isLastVisible && "hover:bg-surface-container-low"
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

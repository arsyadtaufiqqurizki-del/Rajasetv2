import { X } from 'lucide-react';
import type { FilterChip } from '../../types/filters';

export type { FilterChip };

interface FilterChipsProps {
  chips: FilterChip[];
}

export default function FilterChips({ chips }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="flex items-center gap-1.5 bg-surface-container-high border border-outline-variant rounded-full pl-3 pr-1.5 py-1 text-xs text-on-surface"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="p-0.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-error transition-colors"
            aria-label={`Remove filter ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

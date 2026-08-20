import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  visibleCount: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  itemLabel?: string;
}

export default function Pagination({
  page,
  totalPages,
  visibleCount,
  totalCount,
  onPrev,
  onNext,
  itemLabel = 'entries',
}: PaginationProps) {
  return (
    <div className="p-3 border-t border-outline-variant bg-surface-container flex items-center justify-between text-sm mt-auto">
      <span className="text-on-surface-variant">
        Showing {visibleCount} of {totalCount} {itemLabel}
      </span>
      <div className="flex items-center gap-1 text-sm font-medium">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="px-3 py-1 rounded bg-surface-container-high text-on-surface font-semibold text-xs">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          onClick={onNext}
          disabled={page === totalPages || totalPages === 0}
          className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

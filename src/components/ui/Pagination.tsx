import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  visibleCount: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  itemLabel?: string;
  /** Enables First/Last buttons and the page-jump input. Omit to keep the plain Prev/Next control. */
  onPageChange?: (page: number) => void;
  /** Paired with pageSizeOptions + onPageSizeChange to show a rows-per-page selector, and to render an exact "X–Y of Z" range label. */
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  visibleCount,
  totalCount,
  onPrev,
  onNext,
  itemLabel = 'entries',
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
  const clampedTotalPages = Math.max(totalPages, 1);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  const commitJump = () => {
    const parsed = parseInt(jumpInputRef.current?.value ?? '', 10);
    if (onPageChange && Number.isFinite(parsed)) {
      onPageChange(Math.min(Math.max(parsed, 1), clampedTotalPages));
    } else if (jumpInputRef.current) {
      jumpInputRef.current.value = String(page);
    }
  };

  const handleJumpKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitJump();
    }
  };

  const rangeLabel = pageSize
    ? totalCount === 0
      ? `No ${itemLabel}`
      : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} of ${totalCount} ${itemLabel}`
    : `Showing ${visibleCount} of ${totalCount} ${itemLabel}`;

  return (
    <div className="p-3 border-t border-outline-variant bg-surface-container flex flex-wrap items-center justify-between gap-3 text-sm mt-auto">
      <span className="text-on-surface-variant">{rangeLabel}</span>
      <div className="flex items-center gap-3">
        {pageSizeOptions && onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            Rows
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-outline-variant bg-surface px-1.5 py-1 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1 text-sm font-medium">
          {onPageChange && (
            <button
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
              aria-label="First page"
            >
              <ChevronsLeft className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={onPrev}
            disabled={page === 1}
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {onPageChange ? (
            <span className="flex items-center gap-1 px-1 text-xs font-semibold text-on-surface">
              Page
              <input
                key={page}
                ref={jumpInputRef}
                type="text"
                inputMode="numeric"
                defaultValue={String(page)}
                onBlur={commitJump}
                onKeyDown={handleJumpKeyDown}
                aria-label="Jump to page"
                className="w-12 rounded border border-outline-variant bg-surface px-1 py-1 text-center text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
              of {clampedTotalPages}
            </span>
          ) : (
            <span className="px-3 py-1 rounded bg-surface-container-high text-on-surface font-semibold text-xs">
              Page {page} of {clampedTotalPages}
            </span>
          )}
          <button
            onClick={onNext}
            disabled={page === totalPages || totalPages === 0}
            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          {onPageChange && (
            <button
              onClick={() => onPageChange(clampedTotalPages)}
              disabled={page === totalPages || totalPages === 0}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
              aria-label="Last page"
            >
              <ChevronsRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

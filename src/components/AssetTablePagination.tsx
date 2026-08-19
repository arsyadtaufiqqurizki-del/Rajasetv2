import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AssetTablePaginationProps {
  currentPage: number;
  totalPages: number;
  paginatedCount: number;
  filteredCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function AssetTablePagination({
  currentPage,
  totalPages,
  paginatedCount,
  filteredCount,
  onPrevPage,
  onNextPage,
}: AssetTablePaginationProps) {
  return (
    <div className="p-3 border-t border-outline-variant bg-surface-container flex items-center justify-between text-sm mt-auto">
      <span className="text-on-surface-variant">Showing {paginatedCount} of {filteredCount} entries</span>
      <div className="flex items-center gap-1 text-sm font-medium">
        <button
          onClick={onPrevPage}
          disabled={currentPage === 1}
          className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
        >
          <ChevronLeft className="h-5 w-5"/>
        </button>
        <span className="px-3 py-1 rounded bg-surface-container-high text-on-surface font-semibold text-xs">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={onNextPage}
          disabled={currentPage === totalPages}
          className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
        >
          <ChevronRight className="h-5 w-5"/>
        </button>
      </div>
    </div>
  );
}

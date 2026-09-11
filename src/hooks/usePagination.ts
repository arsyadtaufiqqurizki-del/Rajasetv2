import { useCallback, useEffect, useState } from 'react';

/**
 * Pagination state for a filterable list page: current page, page size, and
 * helpers to derive the visible window from the filtered list.
 *
 * Lifted out of Inventory.tsx, Reclassification.tsx, and Maintenance.tsx in
 * Step 8 of "refactoring v2.md", where the trio held three copies of the same
 * `totalPages` + `slice` logic. The shapes differ per page, so the page size is
 * configuration rather than a shared constant:
 * - Inventory persists its size (10/25/50/100) to localStorage and resets to
 *   page 1 whenever it changes — both behaviours are preserved verbatim.
 * - Reclassification and Maintenance hard-code 10 with no persistence.
 *
 * The hook deliberately takes no items: the filtered list only exists after
 * the page's filter hook runs, while the filter hook's reset callback needs
 * `resetPage` up front. Deriving (`paginate` / `totalPagesFor`) happens below,
 * next to the filters, exactly where the old inline `slice` used to live.
 */
export interface PaginationOptions {
  /**
   * Fixed page size. Ignored when `storageKey` is set — the size then comes
   * from localStorage (falling back to `defaultPageSize`).
   */
  pageSize?: number;
  /** When set, the page size is loaded from and saved to this localStorage key. */
  storageKey?: string;
  /** Allowed sizes for the persisted mode; anything else falls back to default. */
  pageSizeOptions?: number[];
  defaultPageSize?: number;
}

export interface Pagination {
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  resetPage: () => void;
  itemsPerPage: number;
  handlePageSizeChange: (size: number) => void;
  /** Page count for a list of `count` rows (always at least 1). */
  totalPagesFor: (count: number) => number;
  /** The visible window of `items` for the current page. */
  paginate: <T>(items: T[]) => T[];
}

function loadStoredPageSize(
  storageKey: string,
  pageSizeOptions: number[],
  defaultPageSize: number
): number {
  try {
    const parsed = Number(localStorage.getItem(storageKey));
    return pageSizeOptions.includes(parsed) ? parsed : defaultPageSize;
  } catch {
    return defaultPageSize;
  }
}

export function usePagination(options: PaginationOptions = {}): Pagination {
  const {
    pageSize = 10,
    storageKey,
    pageSizeOptions = [10, 25, 50, 100],
    defaultPageSize = 10,
  } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [storedPageSize, setStoredPageSize] = useState<number>(() =>
    storageKey ? loadStoredPageSize(storageKey, pageSizeOptions, defaultPageSize) : pageSize
  );

  const itemsPerPage = storageKey ? storedPageSize : pageSize;

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, String(storedPageSize));
    } catch {
      // localStorage unavailable (private mode, etc.) — page size just won't persist
    }
  }, [storageKey, storedPageSize]);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setStoredPageSize(size);
    setCurrentPage(1);
  }, []);

  const totalPagesFor = useCallback(
    (count: number) => Math.max(1, Math.ceil(count / itemsPerPage)),
    [itemsPerPage]
  );

  const paginate = useCallback(
    <T,>(items: T[]): T[] => {
      const start = (currentPage - 1) * itemsPerPage;
      return items.slice(start, start + itemsPerPage);
    },
    [currentPage, itemsPerPage]
  );

  return {
    currentPage,
    setCurrentPage,
    resetPage,
    itemsPerPage,
    handlePageSizeChange,
    totalPagesFor,
    paginate,
  };
}

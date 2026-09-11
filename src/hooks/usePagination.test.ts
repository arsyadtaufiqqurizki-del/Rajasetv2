import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePagination } from './usePagination';

// Step 8 of "refactoring v2.md" pulled the page + slice logic out of
// Inventory.tsx, Reclassification.tsx, and Maintenance.tsx. Two behaviours are
// load-bearing and easy to lose:
//   * Inventory persists its page size to localStorage and falls back to 10 for
//     anything outside the allowed options;
//   * changing the page size resets to page 1 (the old handler did both).

const ITEMS = Array.from({ length: 12 }, (_, i) => `item-${i + 1}`);
const KEY = 'test:pagination:pageSize';

beforeEach(() => {
  localStorage.clear();
});

describe('usePagination — fixed size (Reclassification / Maintenance)', () => {
  it('slices 10 per page by default', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.itemsPerPage).toBe(10);
    expect(result.current.totalPagesFor(ITEMS.length)).toBe(2);
    expect(result.current.paginate(ITEMS)).toHaveLength(10);
    expect(result.current.paginate(ITEMS)[0]).toBe('item-1');
  });

  it('moves between pages and clamps at the ends', () => {
    const { result } = renderHook(() => usePagination());

    act(() => {
      result.current.setCurrentPage(prev => Math.max(1, prev - 1));
    });
    expect(result.current.currentPage).toBe(1);

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginate(ITEMS)).toEqual(['item-11', 'item-12']);
  });

  it('reports a single page for an empty list', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.totalPagesFor(0)).toBe(1);
    expect(result.current.paginate([] as string[])).toEqual([]);
  });

  it('resetPage returns to page 1', () => {
    const { result } = renderHook(() => usePagination());

    act(() => {
      result.current.setCurrentPage(2);
    });
    act(() => {
      result.current.resetPage();
    });

    expect(result.current.currentPage).toBe(1);
  });
});

describe('usePagination — persisted size (Inventory)', () => {
  const persisted = () =>
    renderHook(() => usePagination({ storageKey: KEY, pageSizeOptions: [10, 25, 50, 100] }));

  it('defaults to 10 with nothing stored and persists the size on change', () => {
    const { result } = persisted();

    expect(result.current.itemsPerPage).toBe(10);

    act(() => {
      result.current.handlePageSizeChange(25);
    });

    expect(result.current.itemsPerPage).toBe(25);
    expect(localStorage.getItem(KEY)).toBe('25');
    expect(result.current.paginate(ITEMS)).toHaveLength(12);
  });

  it('changing the size resets to page 1', () => {
    const { result } = persisted();

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.handlePageSizeChange(25);
    });
    expect(result.current.currentPage).toBe(1);
  });

  it('falls back to the default for a stored size outside the options', () => {
    localStorage.setItem(KEY, '7');
    const { result } = persisted();

    expect(result.current.itemsPerPage).toBe(10);
  });

  it('restores the stored size on mount', () => {
    localStorage.setItem(KEY, '50');
    const { result } = persisted();

    expect(result.current.itemsPerPage).toBe(50);
    expect(result.current.totalPagesFor(ITEMS.length)).toBe(1);
  });
});

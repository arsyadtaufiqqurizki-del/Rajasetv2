import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBulkDelete, type BulkDeleteOptions } from './useBulkDelete';

// Step 8 of "refactoring v2.md" pulled the confirm → route → progress sequence
// out of Inventory.tsx and Reclassification.tsx. The load-bearing decision is
// the `hasNoFilters && allSelected` branch: only that combination may take the
// widen deleteAll route. The hook never guesses the predicate — each page
// injects its own — and the orphan cleanup (which must never widen) keeps
// calling deleteMultiple directly instead of using this hook.

function setup(overrides: Partial<BulkDeleteOptions> = {}) {
  const deleteAll = vi.fn(async (_onProgress: (processed: number, failedCount: number) => void) => {});
  const deleteMultiple = vi.fn(
    async (_ids: string[], _onProgress: (processed: number, failedCount: number) => void) => {}
  );
  const clearSelection = vi.fn();
  let selected = new Set(['r-1', 'r-2']);
  let filteredCount = 2;
  let noFilters = true;

  const hook = renderHook(() =>
    useBulkDelete({
      getSelectedIds: () => selected,
      getFilteredCount: () => filteredCount,
      hasNoFilters: () => noFilters,
      deleteAll,
      deleteMultiple,
      clearSelection,
      ...overrides,
    })
  );

  return {
    ...hook,
    deleteAll,
    deleteMultiple,
    clearSelection,
    setSelected: (ids: string[]) => {
      selected = new Set(ids);
    },
    setFilteredCount: (n: number) => {
      filteredCount = n;
    },
    setNoFilters: (v: boolean) => {
      noFilters = v;
    },
  };
}

describe('useBulkDelete — DELETE gate', () => {
  it('does nothing until the text is exactly DELETE', async () => {
    const { result, deleteAll, deleteMultiple } = setup();

    await act(async () => {
      await result.current.handleConfirmDeleteSelected();
    });

    expect(deleteAll).not.toHaveBeenCalled();
    expect(deleteMultiple).not.toHaveBeenCalled();
    expect(result.current.isDeleteModalOpen).toBe(false);
    expect(result.current.deleteProgress.isOpen).toBe(false);
  });

  it('opens and closes the confirm modal, clearing the text', () => {
    const { result } = setup();

    act(() => {
      result.current.openDeleteModal();
    });
    expect(result.current.isDeleteModalOpen).toBe(true);

    act(() => {
      result.current.setDeleteConfirmText('DELETE');
    });
    act(() => {
      result.current.closeDeleteModal();
    });
    expect(result.current.isDeleteModalOpen).toBe(false);
    expect(result.current.deleteConfirmText).toBe('');
  });
});

describe('useBulkDelete — routing (deleteAll vs deleteMultiple)', () => {
  it('takes deleteAll when nothing is filtered and everything is selected', async () => {
    const { result, deleteAll, deleteMultiple, clearSelection } = setup();

    act(() => {
      result.current.openDeleteModal();
    });
    act(() => {
      result.current.setDeleteConfirmText('DELETE');
    });
    await act(async () => {
      await result.current.handleConfirmDeleteSelected();
    });

    expect(deleteAll).toHaveBeenCalledTimes(1);
    expect(deleteAll.mock.calls[0][0]).toBeTypeOf('function'); // onProgress
    expect(deleteMultiple).not.toHaveBeenCalled();
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(result.current.deleteProgress.status).toBe('done');
    expect(result.current.deleteProgress.total).toBe(2);
  });

  it('takes deleteMultiple when a filter is active, even with all rows selected', async () => {
    // Narrow the filtered list to the selection but mark filters active.
    // (mirrors the page-level test with ?subsidiary=…).
    const ctx = setup();
    ctx.setFilteredCount(2);
    ctx.setNoFilters(false);
    act(() => {
      ctx.result.current.setDeleteConfirmText('DELETE');
    });
    await act(async () => {
      await ctx.result.current.handleConfirmDeleteSelected();
    });

    expect(ctx.deleteMultiple).toHaveBeenCalledTimes(1);
    expect(ctx.deleteMultiple.mock.calls[0][0]).toEqual(['r-1', 'r-2']);
    expect(ctx.deleteAll).not.toHaveBeenCalled();
  });

  it('takes deleteMultiple for a partial selection with no filters', async () => {
    const ctx = setup();
    ctx.setSelected(['r-1']);
    ctx.setFilteredCount(12);
    ctx.setNoFilters(true);

    act(() => {
      ctx.result.current.setDeleteConfirmText('DELETE');
    });
    await act(async () => {
      await ctx.result.current.handleConfirmDeleteSelected();
    });

    expect(ctx.deleteMultiple).toHaveBeenCalledTimes(1);
    expect(ctx.deleteMultiple.mock.calls[0][0]).toEqual(['r-1']);
    expect(ctx.deleteAll).not.toHaveBeenCalled();
  });

  it('reports progress through the onProgress callback', async () => {
    let captured: ((processed: number, failed: number) => void) | null = null;
    const deleteMultiple = vi.fn(async (_ids: string[], onProgress: (p: number, f: number) => void) => {
      captured = onProgress;
    });
    const ctx = setup({ deleteMultiple });
    ctx.setSelected(['r-1']);
    ctx.setFilteredCount(12);

    act(() => {
      ctx.result.current.setDeleteConfirmText('DELETE');
    });
    await act(async () => {
      await ctx.result.current.handleConfirmDeleteSelected();
    });

    expect(captured).toBeTypeOf('function');
    act(() => {
      captured! (1, 0);
    });
    expect(ctx.result.current.deleteProgress.processed).toBe(1);
  });
});

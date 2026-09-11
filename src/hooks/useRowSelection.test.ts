import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRowSelection } from './useRowSelection';

// Step 8 of "refactoring v2.md" pulled the Set-based selection out of
// Inventory.tsx and Reclassification.tsx. The load-bearing behaviour: select-all
// covers the ids it is given (the whole filtered list, not just the visible
// page) — the pages pass `filtered…map(id)`, and the characterization tests pin
// the 12-selected-across-pages outcome at the page level.

describe('useRowSelection — select all', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useRowSelection());

    expect(result.current.selectedIds.size).toBe(0);
  });

  it('selects every given id, including ones off the visible page', () => {
    const { result } = renderHook(() => useRowSelection());
    const all = Array.from({ length: 12 }, (_, i) => `r-${i + 1}`);

    act(() => {
      result.current.handleSelectAll(true, all);
    });

    expect(result.current.selectedIds.size).toBe(12);
    expect(result.current.selectedIds.has('r-12')).toBe(true);
  });

  it('unchecking select-all clears the whole set', () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => {
      result.current.handleSelectAll(true, ['a', 'b']);
    });
    act(() => {
      result.current.handleSelectAll(false, ['a', 'b']);
    });

    expect(result.current.selectedIds.size).toBe(0);
  });
});

describe('useRowSelection — select one', () => {
  it('adds and removes a single id', () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => {
      result.current.handleSelectOne('a-1', true);
    });
    expect(result.current.selectedIds.has('a-1')).toBe(true);

    act(() => {
      result.current.handleSelectOne('a-2', true);
    });
    expect(result.current.selectedIds.size).toBe(2);

    act(() => {
      result.current.handleSelectOne('a-1', false);
    });
    expect(result.current.selectedIds.has('a-1')).toBe(false);
    expect(result.current.selectedIds.has('a-2')).toBe(true);
  });

  it('clearSelection empties the set', () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => {
      result.current.handleSelectAll(true, ['a', 'b', 'c']);
    });
    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedIds.size).toBe(0);
  });
});

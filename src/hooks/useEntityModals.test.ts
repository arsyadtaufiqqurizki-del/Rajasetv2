import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEntityModals, useModalState } from './useEntityModals';

// Step 4 of "refactoring v2.md" pulled the add/edit/editing trio out of
// AssetContext and ReclassificationContext. The contexts publish these fields
// under their own names, so what matters here is that the flags and the row
// stay independent of each other — that is what the pages read.

interface Row {
  id: string;
}

const rowA: Row = { id: 'a' };
const rowB: Row = { id: 'b' };

describe('useModalState', () => {
  it('starts closed with no row', () => {
    const { result } = renderHook(() => useModalState<Row>());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.entity).toBeNull();
  });

  it('opens and closes', () => {
    const { result } = renderHook(() => useModalState<Row>());

    act(() => result.current.setIsOpen(true));
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.setIsOpen(false));
    expect(result.current.isOpen).toBe(false);
  });

  it('holds a row and takes null back', () => {
    const { result } = renderHook(() => useModalState<Row>());

    act(() => result.current.setEntity(rowA));
    expect(result.current.entity).toBe(rowA);

    act(() => result.current.setEntity(null));
    expect(result.current.entity).toBeNull();
  });

  it('keeps the row when the modal closes — clearing it is the caller job', () => {
    const { result } = renderHook(() => useModalState<Row>());

    act(() => {
      result.current.setEntity(rowA);
      result.current.setIsOpen(true);
    });
    act(() => result.current.setIsOpen(false));

    expect(result.current.entity).toBe(rowA);
  });

  it('gives each call its own state', () => {
    const { result } = renderHook(() => ({
      verify: useModalState<Row>(),
      other: useModalState<Row>(),
    }));

    act(() => result.current.verify.setIsOpen(true));

    expect(result.current.verify.isOpen).toBe(true);
    expect(result.current.other.isOpen).toBe(false);
  });
});

describe('useEntityModals', () => {
  it('starts with both modals closed and nothing being edited', () => {
    const { result } = renderHook(() => useEntityModals<Row>());

    expect(result.current.isAddModalOpen).toBe(false);
    expect(result.current.isEditModalOpen).toBe(false);
    expect(result.current.editing).toBeNull();
  });

  it('opening add does not open edit', () => {
    const { result } = renderHook(() => useEntityModals<Row>());

    act(() => result.current.setIsAddModalOpen(true));

    expect(result.current.isAddModalOpen).toBe(true);
    expect(result.current.isEditModalOpen).toBe(false);
  });

  it('opening edit does not open add', () => {
    const { result } = renderHook(() => useEntityModals<Row>());

    act(() => result.current.setIsEditModalOpen(true));

    expect(result.current.isEditModalOpen).toBe(true);
    expect(result.current.isAddModalOpen).toBe(false);
  });

  it('carries the row being edited — the usual open-for-edit sequence', () => {
    const { result } = renderHook(() => useEntityModals<Row>());

    act(() => {
      result.current.setEditing(rowA);
      result.current.setIsEditModalOpen(true);
    });

    expect(result.current.editing).toBe(rowA);
    expect(result.current.isEditModalOpen).toBe(true);
  });

  it('replaces the row when a different one is picked', () => {
    const { result } = renderHook(() => useEntityModals<Row>());

    act(() => result.current.setEditing(rowA));
    act(() => result.current.setEditing(rowB));

    expect(result.current.editing).toBe(rowB);
  });

  it('leaves the add modal alone when the edit row is cleared', () => {
    const { result } = renderHook(() => useEntityModals<Row>());

    act(() => {
      result.current.setIsAddModalOpen(true);
      result.current.setEditing(rowA);
    });
    act(() => result.current.setEditing(null));

    expect(result.current.isAddModalOpen).toBe(true);
    expect(result.current.editing).toBeNull();
  });
});

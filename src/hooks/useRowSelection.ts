import { useCallback, useState } from 'react';

/**
 * Row-selection state for a filterable list page: the set of selected ids plus
 * the select-all / select-one updaters every list table in this app carries.
 *
 * Lifted out of Inventory.tsx and Reclassification.tsx in Step 8 of
 * "refactoring v2.md", where the pair held two copies of the same `Set` logic.
 * Select-all always covers the whole filtered list, not just the visible page —
 * that is the behaviour both pages (and their characterization tests) rely on.
 */
export interface RowSelection {
  /** Ids currently selected, across all pages of the filtered list. */
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Selects every id in `filteredIds`, or clears the whole set. */
  handleSelectAll: (checked: boolean, filteredIds: string[]) => void;
  /** Adds or removes one id. */
  handleSelectOne: (id: string, checked: boolean) => void;
  clearSelection: () => void;
}

export function useRowSelection(): RowSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = useCallback((checked: boolean, filteredIds: string[]) => {
    if (checked) {
      setSelectedIds(new Set(filteredIds));
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return { selectedIds, setSelectedIds, handleSelectAll, handleSelectOne, clearSelection };
}

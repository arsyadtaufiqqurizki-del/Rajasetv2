import { useCallback, useEffect, useState } from 'react';

function loadVisibleColumns(storageKey: string, allColumnIds: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set(allColumnIds);
    const parsed = JSON.parse(raw) as string[];
    const validIds = new Set(allColumnIds);
    const restored = parsed.filter(id => validIds.has(id));
    return restored.length > 0 ? new Set(restored) : new Set(allColumnIds);
  } catch {
    return new Set(allColumnIds);
  }
}

export function useColumnVisibility(storageKey: string, allColumnIds: string[]) {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => loadVisibleColumns(storageKey, allColumnIds));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(visibleColumns)));
  }, [storageKey, visibleColumns]);

  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        if (next.size === 1) return prev; // keep at least one column visible
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setVisibleColumns(new Set(allColumnIds));
  }, [allColumnIds]);

  return { visibleColumns, toggleColumn, showAll };
}

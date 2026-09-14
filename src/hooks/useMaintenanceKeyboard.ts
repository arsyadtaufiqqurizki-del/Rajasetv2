import { useEffect } from 'react';

interface UseMaintenanceKeyboardOptions {
  enabled: boolean;
  recordIds: string[];
  focusedRowId: string | null;
  onFocusChange: (id: string | null) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onEscape: () => void;
  isModalOpen: boolean;
}

function isTypingTarget(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useMaintenanceKeyboard({
  enabled,
  recordIds,
  focusedRowId,
  onFocusChange,
  onEdit,
  onDelete,
  onEscape,
  isModalOpen,
}: UseMaintenanceKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      if (isTypingTarget(document.activeElement)) return;
      if (recordIds.length === 0 && e.key !== 'Escape') return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = focusedRowId ? recordIds.indexOf(focusedRowId) : -1;
        const nextIndex =
          e.key === 'ArrowDown'
            ? (currentIndex < 0 ? 0 : Math.min(recordIds.length - 1, currentIndex + 1))
            : (currentIndex < 0 ? recordIds.length - 1 : Math.max(0, currentIndex - 1));
        onFocusChange(recordIds[nextIndex] ?? null);
      } else if (e.key === 'Enter') {
        if (focusedRowId) {
          e.preventDefault();
          onEdit(focusedRowId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (focusedRowId) {
          e.preventDefault();
          onDelete(focusedRowId);
        }
      } else if (e.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, recordIds, focusedRowId, onFocusChange, onEdit, onDelete, onEscape, isModalOpen]);
}

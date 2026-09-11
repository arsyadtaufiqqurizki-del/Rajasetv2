import { useCallback, useState } from 'react';
import type { DeleteProgressState } from '../components/DeleteProgressModal';

/**
 * Bulk-delete flow for a filterable list page: the DELETE-gated confirm state
 * plus the progress modal driven by the context batch-delete callbacks.
 *
 * Lifted out of Inventory.tsx and Reclassification.tsx in Step 8 of
 * "refactoring v2.md", where the pair held two copies of the same confirm →
 * route → progress sequence. The one decision that differs per page — whether
 * the current filter state allows the widen `deleteAll` route — is injected as
 * the `hasNoFilters` predicate, never guessed by the hook. Callers that must
 * never take the `deleteAll` route (the orphan cleanup in Reclassification)
 * keep calling `deleteMultiple…` directly and do not use this hook.
 */
export interface BulkDeleteOptions {
  /** Ids currently selected. Read fresh from a ref at confirm time. */
  getSelectedIds: () => Set<string>;
  /** Length of the filtered list the selection was made against. */
  getFilteredCount: () => number;
  /** True when no filter/search is active, i.e. the deleteAll route is safe. */
  hasNoFilters: () => boolean;
  deleteAll: (onProgress: (processed: number, failedCount: number) => void) => Promise<unknown>;
  deleteMultiple: (
    ids: string[],
    onProgress: (processed: number, failedCount: number) => void
  ) => Promise<unknown>;
  clearSelection: () => void;
}

export interface BulkDelete {
  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deleteConfirmText: string;
  setDeleteConfirmText: React.Dispatch<React.SetStateAction<string>>;
  deleteProgress: DeleteProgressState;
  setDeleteProgress: React.Dispatch<React.SetStateAction<DeleteProgressState>>;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  handleConfirmDeleteSelected: () => Promise<void>;
}

const INITIAL_PROGRESS: DeleteProgressState = {
  isOpen: false,
  status: 'deleting',
  total: 0,
  processed: 0,
  failedCount: 0,
};

export function useBulkDelete(options: BulkDeleteOptions): BulkDelete {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgressState>(INITIAL_PROGRESS);

  const openDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(true);
    setDeleteConfirmText('');
  }, []);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setDeleteConfirmText('');
  }, []);

  const handleConfirmDeleteSelected = useCallback(async () => {
    if (deleteConfirmText !== 'DELETE') return;
    const selectedIds = options.getSelectedIds();
    const total = selectedIds.size;
    const allSelected = selectedIds.size === options.getFilteredCount();

    setIsDeleteModalOpen(false);
    setDeleteConfirmText('');
    setDeleteProgress({ isOpen: true, status: 'deleting', total, processed: 0, failedCount: 0 });

    const onProgress = (processed: number, failedCount: number) => {
      setDeleteProgress(prev => ({ ...prev, processed, failedCount }));
    };

    if (options.hasNoFilters() && allSelected) {
      await options.deleteAll(onProgress);
    } else {
      await options.deleteMultiple(Array.from(selectedIds), onProgress);
    }

    options.clearSelection();
    setDeleteProgress(prev => ({ ...prev, status: 'done' }));
  }, [deleteConfirmText, options]);

  return {
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    deleteConfirmText,
    setDeleteConfirmText,
    deleteProgress,
    setDeleteProgress,
    openDeleteModal,
    closeDeleteModal,
    handleConfirmDeleteSelected,
  };
}

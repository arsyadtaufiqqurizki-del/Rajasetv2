import { useState, useMemo, useEffect, useCallback, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logActivity } from '../lib/activityLogger';
import { AlertCircle, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { useAsset, type Asset } from '../contexts/AssetContext';
import { useAssetFilters } from '../hooks/useAssetFilters';
import { sanitizeCell, toCsvBlob, downloadBlob } from '../lib/csv';
import { computeBookValue } from '../lib/depreciation';
import { startOfToday } from '../lib/dates';
import { parseCost, formatCurrency } from '../lib/money';
import {
  MAX_IMPORT_ROWS,
  buildExportRows,
  mapCsvRowToAssetInput,
  partitionCsvRows,
  type AssetCsvRow,
} from '../lib/assetCsv';
import AssetToolbar from '../components/AssetToolbar';
import AssetFilters from '../components/AssetFilters';
import AssetTable, { ASSET_COLUMNS, DEFAULT_VISIBLE_COLUMNS, ASSET_CSV_FIELDS } from '../components/AssetTable';
import AssetDetailPanel from '../components/AssetDetailPanel';
import Pagination from '../components/ui/Pagination';
import { useRowSelection } from '../hooks/useRowSelection';
import { usePagination } from '../hooks/usePagination';
import { useBulkDelete } from '../hooks/useBulkDelete';
import ColumnVisibilityDropdown from '../components/ColumnVisibilityDropdown';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import InventorySkeleton from '../components/InventorySkeleton';
import ImportProgressModal, { type ImportModalState } from '../components/ImportProgressModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DeleteProgressModal from '../components/DeleteProgressModal';
import BulkEditModal from '../components/BulkEditModal';
import BulkEditProgressModal, { type BulkEditProgressState } from '../components/BulkEditProgressModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import type { AssetBulkPatch } from '../types/asset';
import Toast from '../components/ui/Toast';
import { en as copy } from '../i18n/en';
import Papa from 'papaparse';

const PAGE_SIZE_KEY = 'rajaset:inventory:pageSize';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Inventory() {
  const { assets, loading, error, refetch, deleteAsset, deleteMultipleAssets, deleteAllAssets, bulkUpdateAssets, setEditingAsset, setIsEditModalOpen, setIsAddModalOpen, subsidiaries, categories1, categories2, itemStatuses, addAsset } = useAsset();

  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const selection = useRowSelection();
  const selectedAssets = selection.selectedIds;

  const pagination = usePagination({
    storageKey: PAGE_SIZE_KEY,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  });

  const { visibleColumns, toggleColumn, showAll: showAllColumns } = useColumnVisibility(
    'rajaset:inventory:columns',
    DEFAULT_VISIBLE_COLUMNS
  );

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);

  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditProgress, setBulkEditProgress] = useState<BulkEditProgressState>({
    isOpen: false,
    status: 'updating',
    total: 0,
    processed: 0,
    failedCount: 0,
  });

  const [importModal, setImportModal] = useState<ImportModalState>({
    isOpen: false,
    status: 'importing',
    total: 0,
    processed: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    invalidRows: [],
  });

  const asOf = useMemo(() => startOfToday(), []);
  const bookValues = useMemo(
    () => new Map(assets.map(a => [a.id, computeBookValue(a, asOf).bookValue])),
    [assets, asOf]
  );

  const {
    filters,
    actions: filterActions,
    debouncedSearchQuery,
    sortKey,
    sortDirection,
    toggleSort,
    sortableColumns,
    uniqueStatuses,
    activeFilters,
    filteredAssets,
    clearFilters,
  } = useAssetFilters(assets, searchParams, setSearchParams, () => {
    pagination.resetPage();
    selection.clearSelection();
  }, bookValues);

  // Auto-dismiss notice toast
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.variant === 'error' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const currentPage = pagination.currentPage;
  const setCurrentPage = pagination.setCurrentPage;
  const itemsPerPage = pagination.itemsPerPage;
  const handlePageSizeChange = pagination.handlePageSizeChange;
  const totalPages = pagination.totalPagesFor(filteredAssets.length);
  const paginatedAssets = pagination.paginate(filteredAssets);

  const bulkDelete = useBulkDelete({
    getSelectedIds: () => selection.selectedIds,
    getFilteredCount: () => filteredAssets.length,
    hasNoFilters: () =>
      filters.subsidiary.length === 0 && filters.category.length === 0 && filters.location.length === 0 &&
      filters.status.length === 0 && filters.listed.length === 0 && filters.verification.length === 0 &&
      filters.itemStatus.length === 0 && !filters.dateFrom && !filters.dateTo && !filters.costMin && !filters.costMax && !debouncedSearchQuery,
    deleteAll: (onProgress) => deleteAllAssets(onProgress),
    deleteMultiple: (ids, onProgress) => deleteMultipleAssets(ids, onProgress),
    clearSelection: selection.clearSelection,
  });
  const isDeleteModalOpen = bulkDelete.isDeleteModalOpen;
  const deleteConfirmText = bulkDelete.deleteConfirmText;
  const setDeleteConfirmText = bulkDelete.setDeleteConfirmText;
  const deleteProgressModal = bulkDelete.deleteProgress;
  const setDeleteProgressModal = bulkDelete.setDeleteProgress;
  const handleConfirmDeleteSelected = bulkDelete.handleConfirmDeleteSelected;

  const filteredTotals = useMemo(() => {
    let cost = 0;
    let bookValue = 0;
    let units = 0;
    for (const a of filteredAssets) {
      cost += parseCost(a.assetCost);
      bookValue += bookValues.get(a.id) ?? 0;
      units += Number(a.assetUnits) || 0;
    }
    return { count: filteredAssets.length, units, cost, bookValue };
  }, [filteredAssets, bookValues]);

  const handleEditAsset = useCallback((asset: Asset) => {
    setEditingAsset(asset);
    setIsEditModalOpen(true);
  }, [setEditingAsset, setIsEditModalOpen]);

  const handleEditFromDetail = useCallback((asset: Asset) => {
    setDetailAsset(null);
    handleEditAsset(asset);
  }, [handleEditAsset]);

  const handleDeleteAsset = useCallback((assetId: string) => {
    setPendingDeleteId(assetId);
  }, []);

  const handleConfirmDeleteAsset = useCallback(() => {
    if (pendingDeleteId) deleteAsset(pendingDeleteId);
    setPendingDeleteId(null);
  }, [pendingDeleteId, deleteAsset]);

  // AssetTable calls onSelectAll with the checkbox state only; the hook covers the
  // whole filtered list (not just the visible page), as before.
  const handleSelectAll = useCallback((checked: boolean) => {
    selection.handleSelectAll(checked, filteredAssets.map(a => a.id));
  }, [selection, filteredAssets]);

  const handleSelectAsset = selection.handleSelectOne;

  const handleExportCSV = useCallback((scope: 'all' | 'selected', columnsScope: 'visible' | 'all') => {
    const sourceAssets = scope === 'selected'
      ? filteredAssets.filter(a => selectedAssets.has(a.id))
      : filteredAssets;

    if (sourceAssets.length === 0) return;

    setIsExporting(true);

    const exportColumnIds = columnsScope === 'all'
      ? ASSET_COLUMNS.map(c => c.id)
      : ASSET_COLUMNS.filter(c => visibleColumns.has(c.id)).map(c => c.id);

    // Let the spinner paint before the synchronous CSV build blocks the thread
    setTimeout(() => {
      const dataToExport = buildExportRows(sourceAssets, exportColumnIds, ASSET_CSV_FIELDS, bookValues, sanitizeCell);

      downloadBlob(
        `Asset_Inventory_${scope === 'selected' ? 'Selected_' : ''}${new Date().toISOString().split('T')[0]}.csv`,
        toCsvBlob(dataToExport)
      );

      setIsExporting(false);
      setNotice({ message: `Exported ${sourceAssets.length} row${sourceAssets.length === 1 ? '' : 's'} to CSV`, variant: 'success' });
    }, 0);
  }, [filteredAssets, selectedAssets, bookValues, visibleColumns]);

  const handleImportCSV = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as AssetCsvRow[];

        if (data.length > MAX_IMPORT_ROWS) {
          setNotice({ message: `File exceeds the maximum limit of ${MAX_IMPORT_ROWS} rows. Your file has ${data.length} rows. Please split your file and try again.`, variant: 'error' });
          if (event.target) event.target.value = '';
          return;
        }

        const { validRows, invalidRows } = partitionCsvRows(data);

        setImportModal({
          isOpen: true,
          status: 'importing',
          total: validRows.length,
          processed: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: invalidRows.length,
          invalidRows,
        });

        const BATCH_SIZE = 10;
        let localSuccess = 0;
        let localFailed = 0;
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(row => {
            return addAsset(mapCsvRowToAssetInput(row), true)
            .then(() => {
              localSuccess++;
              setImportModal(prev => ({
                ...prev,
                processed: prev.processed + 1,
                successCount: prev.successCount + 1,
              }));
            })
            .catch(() => {
              localFailed++;
              setImportModal(prev => ({
                ...prev,
                processed: prev.processed + 1,
                failedCount: prev.failedCount + 1,
              }));
            });
          }));
        }

        setImportModal(prev => ({ ...prev, status: 'done' }));
        logActivity({ actionType: 'IMPORT_CSV', entityType: 'asset', details: { total: validRows.length + invalidRows.length, success: localSuccess, failed: localFailed + invalidRows.length } });
        if (event.target) event.target.value = '';
      },
      error: (error) => {
        setNotice({ message: 'Error parsing CSV file: ' + error.message, variant: 'error' });
      }
    });
  }, [addAsset]);

  const handleDownloadInvalidRows = useCallback(() => {
    const rows = importModal.invalidRows;
    if (rows.length === 0) return;
    const dataToExport = rows.map(r => ({
      'Row Number': r.rowNumber,
      'Asset Number': sanitizeCell(r.assetNumber),
      'Asset Description': sanitizeCell(r.assetDescription),
      'Reason': r.reason,
    }));
    downloadBlob('invalid_rows.csv', toCsvBlob(dataToExport));
  }, [importModal.invalidRows]);

  const handleApplyBulkEdit = useCallback(async (patch: AssetBulkPatch) => {
    const ids = Array.from(selectedAssets);
    const total = ids.length;

    setIsBulkEditModalOpen(false);
    setBulkEditProgress({ isOpen: true, status: 'updating', total, processed: 0, failedCount: 0 });

    const { updated, failed } = await bulkUpdateAssets(
      ids,
      patch,
      (processed, failedCount) => {
        setBulkEditProgress(prev => ({ ...prev, processed, failedCount }));
      },
    );

    setBulkEditProgress(prev => ({ ...prev, status: 'done' }));
    selection.clearSelection();

    setNotice(
      failed > 0
        ? { message: `Updated ${updated} assets, ${failed} failed`, variant: 'error' }
        : { message: `Updated ${updated} asset${updated === 1 ? '' : 's'}`, variant: 'success' },
    );
  }, [selectedAssets, bulkUpdateAssets, selection]);

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-11rem)] min-h-[600px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Asset Inventory</h2>
          <p className="text-sm text-on-surface-variant mt-1">Manage and track enterprise assets across all subsidiaries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ColumnVisibilityDropdown
            columns={ASSET_COLUMNS}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            onShowAll={showAllColumns}
          />
          <AssetToolbar
            onImportCSV={handleImportCSV}
            isImporting={importModal.isOpen && importModal.status === 'importing'}
            onAddNew={() => setIsAddModalOpen(true)}
            selectedCount={selectedAssets.size}
            filteredCount={filteredAssets.length}
            isExporting={isExporting}
            onExport={handleExportCSV}
          />
        </div>
      </div>

      {loading ? (
        <InventorySkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center rounded-xl border border-outline-variant bg-surface-container-lowest flex-1">
          <AlertTriangle className="h-10 w-10 text-error" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold text-on-surface">Failed to load asset data</p>
            <p className="mt-1 text-sm text-on-surface-variant">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <AssetFilters
            filters={filters}
            actions={filterActions}
            options={{ subsidiaries, categories1, categories2, itemStatuses, uniqueStatuses }}
            activeFilters={activeFilters}
          />

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden">
            {selectedAssets.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-primary/5 border-b border-outline-variant text-sm">
                <span className="text-on-surface">
                  <strong>{selectedAssets.size}</strong> asset{selectedAssets.size === 1 ? '' : 's'} selected
                  {selectedAssets.size > paginatedAssets.filter(a => selectedAssets.has(a.id)).length && (
                    <span className="text-on-surface-variant"> across all filtered pages</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBulkEditModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit Selected
                  </button>
                  <button
                    type="button"
                    onClick={bulkDelete.openDeleteModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-error text-on-error rounded-md hover:bg-error/90 font-medium text-sm transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Selected
                  </button>
                  <span className="w-px self-stretch bg-outline-variant" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={selection.clearSelection}
                    className="font-medium text-secondary hover:text-primary transition-colors"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 bg-surface-container-low border-b border-outline-variant text-xs text-on-surface-variant">
              <span><strong className="text-on-surface">{filteredTotals.count.toLocaleString()}</strong> asset{filteredTotals.count === 1 ? '' : 's'}</span>
              <span><strong className="text-on-surface">{filteredTotals.units.toLocaleString()}</strong> units</span>
              <span>Total Asset Cost <strong className="font-mono text-on-surface">{formatCurrency(filteredTotals.cost)}</strong></span>
              <span>Total Book Value <strong className="font-mono text-on-surface">{formatCurrency(filteredTotals.bookValue)}</strong></span>
            </div>
            <AssetTable
              paginatedAssets={paginatedAssets}
              filteredAssets={filteredAssets}
              selectedAssets={selectedAssets}
              bookValues={bookValues}
              visibleColumns={visibleColumns}
              onSelectAll={handleSelectAll}
              onSelectAsset={handleSelectAsset}
              onEditAsset={handleEditAsset}
              onDeleteAsset={handleDeleteAsset}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={toggleSort}
              sortableColumns={sortableColumns}
              hasActiveFilters={activeFilters.length > 0}
              onClearFilters={clearFilters}
              onAddNew={() => setIsAddModalOpen(true)}
              onRowClick={setDetailAsset}
            />
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              visibleCount={paginatedAssets.length}
              totalCount={filteredAssets.length}
              onPrev={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              onNext={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              onPageChange={setCurrentPage}
              pageSize={itemsPerPage}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={handlePageSizeChange}
              itemLabel="assets"
            />
          </div>
        </>
      )}

      <ImportProgressModal
        importModal={importModal}
        onClose={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
        onDownloadInvalidRows={handleDownloadInvalidRows}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        selectedCount={selectedAssets.size}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onCancel={bulkDelete.closeDeleteModal}
        onConfirm={handleConfirmDeleteSelected}
      />

      <DeleteProgressModal
        deleteProgressModal={deleteProgressModal}
        onClose={() => setDeleteProgressModal(prev => ({ ...prev, isOpen: false }))}
      />

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        selectedCount={selectedAssets.size}
        onCancel={() => setIsBulkEditModalOpen(false)}
        onApply={handleApplyBulkEdit}
      />

      <BulkEditProgressModal
        bulkEditProgress={bulkEditProgress}
        onClose={() => setBulkEditProgress(prev => ({ ...prev, isOpen: false }))}
      />

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title={copy.confirm.deleteAssetTitle}
        message={copy.confirm.deleteAssetMessage}
        confirmLabel={copy.confirm.deleteLabel}
        cancelLabel={copy.confirm.cancelLabel}
        destructive
        onConfirm={handleConfirmDeleteAsset}
        onCancel={() => setPendingDeleteId(null)}
      />

      <Toast
        message={notice?.message ?? null}
        icon={notice?.variant === 'error' ? <AlertCircle className="h-4 w-4 text-error shrink-0" /> : undefined}
        onClose={() => setNotice(null)}
      />

      <AssetDetailPanel
        asset={detailAsset}
        bookValue={detailAsset ? bookValues.get(detailAsset.id) ?? 0 : 0}
        onClose={() => setDetailAsset(null)}
        onEdit={handleEditFromDetail}
      />
    </div>
  );
}

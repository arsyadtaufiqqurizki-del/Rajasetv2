import { useState, useMemo, useEffect, useCallback, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logActivity } from '../lib/activityLogger';
import { AlertCircle } from 'lucide-react';
import { useAsset, type Asset } from '../contexts/AssetContext';
import { useAssetFilters } from '../hooks/useAssetFilters';
import { sanitizeCell, toCsvBlob, downloadBlob } from '../lib/csv';
import { computeBookValue } from '../lib/depreciation';
import { startOfToday } from '../lib/dates';
import AssetToolbar from '../components/AssetToolbar';
import AssetFilters from '../components/AssetFilters';
import AssetTable, { ASSET_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from '../components/AssetTable';
import AssetTablePagination from '../components/AssetTablePagination';
import ColumnVisibilityDropdown from '../components/ColumnVisibilityDropdown';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import ImportProgressModal, { type ImportModalState } from '../components/ImportProgressModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DeleteProgressModal, { type DeleteProgressState } from '../components/DeleteProgressModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import Toast from '../components/ui/Toast';
import { en as copy } from '../i18n/en';
import Papa from 'papaparse';

export default function Inventory() {
  const { assets, deleteAsset, deleteMultipleAssets, deleteAllAssets, setEditingAsset, setIsEditModalOpen, setIsAddModalOpen, subsidiaries, categories1, categories2, itemStatuses, addAsset } = useAsset();

  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { visibleColumns, toggleColumn, showAll: showAllColumns } = useColumnVisibility(
    'rajaset:inventory:columns',
    DEFAULT_VISIBLE_COLUMNS
  );

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [deleteProgressModal, setDeleteProgressModal] = useState<DeleteProgressState>({
    isOpen: false,
    status: 'deleting',
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

  const {
    filterSubsidiary, setFilterSubsidiary,
    filterCategory, setFilterCategory,
    filterLocation, setFilterLocation,
    filterStatus, setFilterStatus,
    filterVerification, setFilterVerification,
    filterItemStatus, setFilterItemStatus,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    costMin, setCostMin,
    costMax, setCostMax,
    searchQuery, setSearchQuery,
    debouncedSearchQuery,
    uniqueStatuses,
    activeFilters,
    filteredAssets,
    clearFilters,
  } = useAssetFilters(assets, searchParams, setSearchParams, () => setCurrentPage(1));

  // Auto-dismiss notice toast
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.variant === 'error' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / itemsPerPage));

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAssets.slice(start, start + itemsPerPage);
  }, [filteredAssets, currentPage]);

  const asOf = useMemo(() => startOfToday(), []);
  const bookValues = useMemo(
    () => new Map(assets.map(a => [a.id, computeBookValue(a, asOf).bookValue])),
    [assets, asOf]
  );

  const handleEditAsset = useCallback((asset: Asset) => {
    setEditingAsset(asset);
    setIsEditModalOpen(true);
  }, [setEditingAsset, setIsEditModalOpen]);

  const handleDeleteAsset = useCallback((assetId: string) => {
    setPendingDeleteId(assetId);
  }, []);

  const handleConfirmDeleteAsset = useCallback(() => {
    if (pendingDeleteId) deleteAsset(pendingDeleteId);
    setPendingDeleteId(null);
  }, [pendingDeleteId, deleteAsset]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedAssets(new Set(filteredAssets.map(a => a.id)));
    } else {
      setSelectedAssets(new Set());
    }
  }, [filteredAssets]);

  const handleSelectAsset = useCallback((assetId: string, checked: boolean) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(assetId);
      } else {
        newSet.delete(assetId);
      }
      return newSet;
    });
  }, []);

  const handleExportCSV = useCallback((scope: 'all' | 'selected') => {
    const sourceAssets = scope === 'selected'
      ? filteredAssets.filter(a => selectedAssets.has(a.id))
      : filteredAssets;

    if (sourceAssets.length === 0) return;

    setIsExporting(true);

    // Let the spinner paint before the synchronous CSV build blocks the thread
    setTimeout(() => {
      const dataToExport = sourceAssets.map(asset => ({
        'Asset Number': sanitizeCell(asset.assetNumber),
        'Asset Description': sanitizeCell(asset.assetDescription),
        'Asset Book': sanitizeCell(asset.assetBook),
        'Subsidiary': sanitizeCell(asset.subsidiary),
        'Asset Cost': asset.assetCost,
        'Book Value': bookValues.get(asset.id) ?? 0,
        'Date Place In Service': asset.datePlaceInService,
        'Asset Units': asset.assetUnits,
        'Asset Category Segment 1': sanitizeCell(asset.categorySegment1),
        'Asset Category Segment 2': sanitizeCell(asset.categorySegment2),
        'Depreciation Method': sanitizeCell(asset.depreciationMethod),
        'Life in Months': asset.lifeInMonths,
        'Listed': asset.listed,
        'Status': sanitizeCell(asset.status),
        'Verification': asset.verification ? 'Yes' : 'No',
        'Verification Date': asset.verificationDate,
        'Item Status': sanitizeCell(asset.itemStatus)
      }));

      downloadBlob(
        `Asset_Inventory_${scope === 'selected' ? 'Selected_' : ''}${new Date().toISOString().split('T')[0]}.csv`,
        toCsvBlob(dataToExport)
      );

      setIsExporting(false);
      setNotice({ message: `Exported ${sourceAssets.length} row${sourceAssets.length === 1 ? '' : 's'} to CSV`, variant: 'success' });
    }, 0);
  }, [filteredAssets, selectedAssets, bookValues]);

  const handleImportCSV = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];

        if (data.length > 5000) {
          setNotice({ message: `File exceeds the maximum limit of 5000 rows. Your file has ${data.length} rows. Please split your file and try again.`, variant: 'error' });
          if (event.target) event.target.value = '';
          return;
        }

        const validRows: any[] = [];
        const invalidRows: { rowNumber: number; assetNumber: string; assetDescription: string; reason: string }[] = [];

        data.forEach((row, index) => {
          const assetNumber = row['Asset Number'] || row['assetNumber'] || '';
          const assetDescription = row['Asset Description'] || row['assetDescription'] || '';
          const missingNumber = !assetNumber;
          const missingDescription = !assetDescription;

          if (missingNumber || missingDescription) {
            const reasons = [];
            if (missingNumber) reasons.push('Asset Number kosong');
            if (missingDescription) reasons.push('Asset Description kosong');
            invalidRows.push({
              rowNumber: index + 2, // +2 karena baris 1 = header
              assetNumber,
              assetDescription,
              reason: reasons.join(', '),
            });
          } else {
            validRows.push(row);
          }
        });

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
            const assetNumber = row['Asset Number'] || row['assetNumber'];
            const assetDescription = row['Asset Description'] || row['assetDescription'];
            return addAsset({
              assetBook: row['Asset Book'] || row['assetBook'] || '',
              subsidiary: row['Subsidiary'] || row['subsidiary'] || 'Default',
              assetNumber,
              assetDescription,
              assetCost: row['Asset Cost'] || row['assetCost'] || '0',
              datePlaceInService: row['Date Place In Service'] || row['datePlaceInService'] || '',
              assetUnits: row['Asset Units'] || row['assetUnits'] || '1',
              categorySegment1: row['Asset Category Segment 1'] || row['categorySegment1'] || 'Uncategorized',
              categorySegment2: row['Asset Category Segment 2'] || row['categorySegment2'] || 'Uncategorized',
              depreciationMethod: row['Depreciation Method'] || row['depreciationMethod'] || '',
              lifeInMonths: row['Life in Months'] || row['lifeInMonths'] || '0',
              listed: row['Listed'] || row['listed'] || 'No',
              status: row['Status'] || row['status'] || 'Active',
              verification: String(row['Verification'] || row['verification'] || 'No').trim().toLowerCase() === 'yes',
              verificationDate: row['Verification Date'] || row['verificationDate'] || '',
              itemStatus: row['Item Status'] || row['itemStatus'] || '',
            }, true)
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

  const handleConfirmDeleteSelected = useCallback(async () => {
    if (deleteConfirmText !== 'DELETE') return;
    const total = selectedAssets.size;
    const noFilters = filterSubsidiary.length === 0 && filterCategory.length === 0 && filterLocation.length === 0 && filterStatus.length === 0 && filterVerification.length === 0 && filterItemStatus.length === 0 && !dateFrom && !dateTo && !costMin && !costMax && !debouncedSearchQuery;
    const allSelected = selectedAssets.size === filteredAssets.length;

    setIsDeleteModalOpen(false);
    setDeleteConfirmText('');
    setDeleteProgressModal({ isOpen: true, status: 'deleting', total, processed: 0, failedCount: 0 });

    const onProgress = (processed: number, failedCount: number) => {
      setDeleteProgressModal(prev => ({ ...prev, processed, failedCount }));
    };

    if (noFilters && allSelected) {
      await deleteAllAssets(onProgress);
    } else {
      await deleteMultipleAssets(Array.from(selectedAssets), onProgress);
    }

    setSelectedAssets(new Set());
    setDeleteProgressModal(prev => ({ ...prev, status: 'done' }));
  }, [deleteConfirmText, selectedAssets, filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery, filteredAssets, deleteAllAssets, deleteMultipleAssets]);

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-[180px])] min-h-[600px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Asset Inventory</h2>
          <p className="text-sm text-on-surface-variant mt-1">Manage and track enterprise assets across all subsidiaries.</p>
        </div>
        <div className="flex items-center gap-3">
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
            onDeleteSelectedClick={() => { setIsDeleteModalOpen(true); setDeleteConfirmText(""); }}
            filteredCount={filteredAssets.length}
            isExporting={isExporting}
            onExport={handleExportCSV}
          />
        </div>
      </div>

      <AssetFilters
        subsidiaries={subsidiaries}
        categories1={categories1}
        categories2={categories2}
        itemStatuses={itemStatuses}
        uniqueStatuses={uniqueStatuses}
        filterSubsidiary={filterSubsidiary}
        setFilterSubsidiary={setFilterSubsidiary}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterLocation={filterLocation}
        setFilterLocation={setFilterLocation}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterVerification={filterVerification}
        setFilterVerification={setFilterVerification}
        filterItemStatus={filterItemStatus}
        setFilterItemStatus={setFilterItemStatus}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        costMin={costMin}
        setCostMin={setCostMin}
        costMax={costMax}
        setCostMax={setCostMax}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeFilters={activeFilters}
        onClearFilters={clearFilters}
      />

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden">
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
        />
        <AssetTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          paginatedCount={paginatedAssets.length}
          filteredCount={filteredAssets.length}
          onPrevPage={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          onNextPage={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        />
      </div>

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
        onCancel={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
        onConfirm={handleConfirmDeleteSelected}
      />

      <DeleteProgressModal
        deleteProgressModal={deleteProgressModal}
        onClose={() => setDeleteProgressModal(prev => ({ ...prev, isOpen: false }))}
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
      />
    </div>
  );
}

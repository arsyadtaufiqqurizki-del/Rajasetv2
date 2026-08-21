import { useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sanitizeCell, toCsvBlob, downloadBlob } from '../lib/csv';
import { useReclassification } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import { useReclassificationFilters } from '../hooks/useReclassificationFilters';
import type { Reclassification } from '../types/reclassification';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import ProgressModal from '../components/ui/ProgressModal';
import ReclassificationStats from '../components/ReclassificationStats';
import ReclassificationToolbar from '../components/ReclassificationToolbar';
import ReclassificationTable from '../components/ReclassificationTable';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DeleteProgressModal, { type DeleteProgressState } from '../components/DeleteProgressModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { id as copy } from '../i18n/id';

export default function Reclassification() {
  const {
    reclassifications, deleteReclassification,
    deleteMultipleReclassifications, deleteAllReclassifications,
    setEditingReclassification, setIsEditModalOpen,
    setVerifyingReclassification, setIsVerifyModalOpen,
    setIsAddModalOpen, syncFromAssets,
  } = useReclassification();
  const { assets, itemStatuses } = useAsset();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const {
    filterCategory, setFilterCategory,
    filterVerified, setFilterVerified,
    filterOwnership, setFilterOwnership,
    filterAssetCategory, setFilterAssetCategory,
    filterLocation, setFilterLocation,
    searchQuery, setSearchQuery,
    debouncedSearchQuery,
    uniqueCategories, uniqueOwnerships, uniqueAssetCategories, uniqueLocations,
    activeFilters,
    filteredItems,
    clearFilters,
  } = useReclassificationFilters(reclassifications, itemStatuses, searchParams, setSearchParams, () => setCurrentPage(1));

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [deleteProgressModal, setDeleteProgressModal] = useState<DeleteProgressState>({
    isOpen: false,
    status: 'deleting',
    total: 0,
    processed: 0,
    failedCount: 0,
  });

  const [syncModal, setSyncModal] = useState<{
    isOpen: boolean;
    status: 'syncing' | 'done';
    total: number;
    processed: number;
    successCount: number;
    failedCount: number;
    errors: string[];
  }>({
    isOpen: false,
    status: 'syncing',
    total: 0,
    processed: 0,
    successCount: 0,
    failedCount: 0,
    errors: [],
  });

  const stats = useMemo(() => {
    const total = reclassifications.length;
    const verified = reclassifications.filter(r => r.verified).length;
    const unverified = total - verified;
    const needsReview = reclassifications.filter(r => r.category === 'Needs Review').length;
    return { total, verified, unverified, needsReview };
  }, [reclassifications]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const handleExportCSV = useCallback(() => {
    const dataToExport = filteredItems.map(item => ({
      'Asset Category': sanitizeCell(item.assetCategory),
      'Asset Description': sanitizeCell(item.assetDescription),
      'Location': sanitizeCell(item.location),
      'Unit': item.unit,
      'Ownership': sanitizeCell(item.ownership),
      'Item Status': sanitizeCell(item.category),
      'Remarks': sanitizeCell(item.remarks),
      'Verification': item.verified ? 'Yes' : 'No',
      'Verification Date': item.verificationDate,
      'Verified By': sanitizeCell(item.verifiedBy),
    }));

    downloadBlob(`Asset_Reclassification_${new Date().toISOString().split('T')[0]}.csv`, toCsvBlob(dataToExport));
  }, [filteredItems]);

  const handleSyncFromAssets = useCallback(async () => {
    setSyncModal({ isOpen: true, status: 'syncing', total: 0, processed: 0, successCount: 0, failedCount: 0, errors: [] });
    const result = await syncFromAssets(assets, (processed, total, failed) => {
      setSyncModal(prev => ({ ...prev, total, processed, failedCount: failed, successCount: processed - failed }));
    });
    setSyncModal({
      isOpen: true,
      status: 'done',
      total: result.total,
      processed: result.total,
      successCount: result.success,
      failedCount: result.failed,
      errors: result.errors,
    });
  }, [assets, syncFromAssets]);

  const handleEdit = useCallback((item: Reclassification) => {
    setEditingReclassification(item);
    setIsEditModalOpen(true);
  }, [setEditingReclassification, setIsEditModalOpen]);

  const handleVerify = useCallback((item: Reclassification) => {
    setVerifyingReclassification(item);
    setIsVerifyModalOpen(true);
  }, [setVerifyingReclassification, setIsVerifyModalOpen]);

  const handleDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteId) deleteReclassification(pendingDeleteId);
    setPendingDeleteId(null);
  }, [pendingDeleteId, deleteReclassification]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  }, [filteredItems]);

  const handleSelectItem = useCallback((id: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  const handleConfirmDeleteSelected = useCallback(async () => {
    if (deleteConfirmText !== 'DELETE') return;
    const total = selectedItems.size;
    const noFilters = filterCategory.length === 0 && filterVerified.length === 0 && filterOwnership.length === 0 && filterAssetCategory.length === 0 && filterLocation.length === 0 && !debouncedSearchQuery;
    const allSelected = selectedItems.size === filteredItems.length;

    setIsDeleteModalOpen(false);
    setDeleteConfirmText('');
    setDeleteProgressModal({ isOpen: true, status: 'deleting', total, processed: 0, failedCount: 0 });

    const onProgress = (processed: number, failedCount: number) => {
      setDeleteProgressModal(prev => ({ ...prev, processed, failedCount }));
    };

    if (noFilters && allSelected) {
      await deleteAllReclassifications(onProgress);
    } else {
      await deleteMultipleReclassifications(Array.from(selectedItems), onProgress);
    }

    setSelectedItems(new Set());
    setDeleteProgressModal(prev => ({ ...prev, status: 'done' }));
  }, [deleteConfirmText, selectedItems, filterCategory, filterVerified, filterOwnership, filterAssetCategory, filterLocation, debouncedSearchQuery, filteredItems, deleteAllReclassifications, deleteMultipleReclassifications]);

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-[180px])] min-h-[600px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Asset Reclassification</h2>
          <p className="text-sm text-on-surface-variant mt-1">Catat dan verifikasi temuan audit fisik aset.</p>
        </div>
        <ReclassificationToolbar
          onSyncFromAssets={handleSyncFromAssets}
          isSyncing={syncModal.isOpen && syncModal.status === 'syncing'}
          onExport={handleExportCSV}
          onAddNew={() => setIsAddModalOpen(true)}
          selectedCount={selectedItems.size}
          onDeleteSelectedClick={() => { setIsDeleteModalOpen(true); setDeleteConfirmText(''); }}
        />
      </div>

      <ReclassificationStats
        total={stats.total}
        verified={stats.verified}
        unverified={stats.unverified}
        needsReview={stats.needsReview}
      />

      <FilterBar
        className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Cari deskripsi atau lokasi..."
        chips={activeFilters}
        onClearFilters={clearFilters}
      >
        <MultiSelectDropdown
          placeholder="All Item Statuses"
          options={uniqueCategories}
          selected={filterCategory}
          onChange={setFilterCategory}
        />
        <MultiSelectDropdown
          placeholder="All Verification"
          options={['Yes', 'No']}
          selected={filterVerified}
          onChange={setFilterVerified}
        />
        <MultiSelectDropdown
          placeholder="All Ownership"
          options={uniqueOwnerships}
          selected={filterOwnership}
          onChange={setFilterOwnership}
        />
        <MultiSelectDropdown
          placeholder="All Asset Categories"
          options={uniqueAssetCategories}
          selected={filterAssetCategory}
          onChange={setFilterAssetCategory}
        />
        <MultiSelectDropdown
          placeholder="All Locations"
          options={uniqueLocations}
          selected={filterLocation}
          onChange={setFilterLocation}
        />
      </FilterBar>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden">
        <ReclassificationTable
          paginatedItems={paginatedItems}
          filteredItems={filteredItems}
          selectedItems={selectedItems}
          onSelectAll={handleSelectAll}
          onSelectItem={handleSelectItem}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onVerify={handleVerify}
        />

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          visibleCount={paginatedItems.length}
          totalCount={filteredItems.length}
          onPrev={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          onNext={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
        />
      </div>

      <ProgressModal
        isOpen={syncModal.isOpen}
        status={syncModal.status === 'syncing' ? 'busy' : 'done'}
        busyTitle="Syncing from Assets..."
        busyDescription="Menambahkan asset yang belum tertaut sebagai baseline audit."
        total={syncModal.total}
        processed={syncModal.processed}
        unit="assets processed"
        doneTitle="Sync Complete"
        hasWarning={syncModal.failedCount > 0}
        stats={syncModal.total === 0 ? [] : [
          { label: 'Berhasil ditautkan', value: `${syncModal.successCount} asset`, tone: 'success' },
          ...(syncModal.failedCount > 0 ? [{ label: 'Gagal', value: `${syncModal.failedCount} asset`, tone: 'error' as const }] : []),
        ]}
        onClose={() => setSyncModal(prev => ({ ...prev, isOpen: false }))}
      >
        {syncModal.status === 'done' && syncModal.total === 0 && (
          <p className="text-sm text-on-surface-variant mb-4">Semua asset sudah tertaut ke Reclassification.</p>
        )}
        {syncModal.errors.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-error mb-1.5">Detail error</p>
            <div className="max-h-40 overflow-y-auto bg-error-container/20 border border-error/20 rounded-xl p-3 space-y-1.5">
              {syncModal.errors.map((message, idx) => (
                <p key={idx} className="text-xs text-error break-words">{message}</p>
              ))}
            </div>
          </div>
        )}
      </ProgressModal>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        selectedCount={selectedItems.size}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onCancel={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
        onConfirm={handleConfirmDeleteSelected}
        itemLabel="reclassification items"
      />

      <DeleteProgressModal
        deleteProgressModal={deleteProgressModal}
        onClose={() => setDeleteProgressModal(prev => ({ ...prev, isOpen: false }))}
        itemLabel="items"
      />

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title={copy.confirm.deleteReclassificationTitle}
        message={copy.confirm.deleteReclassificationMessage}
        confirmLabel={copy.confirm.deleteLabel}
        cancelLabel={copy.confirm.cancelLabel}
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}

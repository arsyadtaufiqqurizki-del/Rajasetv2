import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, AlertCircle, AlertTriangle, Download } from 'lucide-react';
import { formatCurrency, parseCost } from '../lib/money';
import { sanitizeCell, toCsvBlob, downloadBlob } from '../lib/csv';
import { logActivity } from '../lib/activityLogger';
import {
  MAINTENANCE_CSV_COLUMN_IDS,
  buildMaintenanceExportRows,
} from '../lib/maintenanceCsv';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useMaintenanceFilters } from '../hooks/useMaintenanceFilters';
import { usePagination } from '../hooks/usePagination';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { useRowSelection } from '../hooks/useRowSelection';
import { useBulkDelete } from '../hooks/useBulkDelete';
import { useMaintenanceKeyboard } from '../hooks/useMaintenanceKeyboard';
import AddMaintenanceModal from '../components/AddMaintenanceModal';
import EditMaintenanceModal from '../components/EditMaintenanceModal';
import MaintenanceStats from '../components/MaintenanceStats';
import MaintenanceTable, { MAINTENANCE_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from '../components/MaintenanceTable';
import MaintenanceSkeleton from '../components/MaintenanceSkeleton';
import MaintenanceEmptyState from '../components/MaintenanceEmptyState';
import MaintenanceViewSwitcher, { type MaintenanceView } from '../components/MaintenanceViewSwitcher';
import MaintenanceCalendarView from '../components/MaintenanceCalendarView';
import MaintenanceTimelineView from '../components/MaintenanceTimelineView';
import MaintenanceBulkBar from '../components/MaintenanceBulkBar';
import MaintenanceBulkStatusModal from '../components/MaintenanceBulkStatusModal';
import BulkUpdateProgressModal, { type BulkUpdateProgressState } from '../components/BulkUpdateProgressModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DeleteProgressModal from '../components/DeleteProgressModal';
import ColumnVisibilityDropdown from '../components/ColumnVisibilityDropdown';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import ConfirmModal from '../components/ui/ConfirmModal';
import Toast from '../components/ui/Toast';

const PAGE_SIZE_KEY = 'rajaset:maintenance:pageSize';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function parseView(param: string | null): MaintenanceView {
  if (param === 'timeline' || param === 'calendar') return param;
  return 'table';
}

export default function Maintenance() {
  const { records, loading, error, deleteRecord, updateStatus, deleteMultipleRecords, deleteAllRecords, bulkUpdateStatus } = useMaintenance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState<BulkUpdateProgressState>({ isOpen: false, status: 'updating', total: 0, processed: 0, failedCount: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportAllColumns, setExportAllColumns] = useState(false);

  const view = parseView(searchParams.get('view'));

  const pagination = usePagination({
    storageKey: PAGE_SIZE_KEY,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  });

  const { visibleColumns, toggleColumn, showAll: showAllColumns } = useColumnVisibility(
    'rajaset:maintenance:columns',
    DEFAULT_VISIBLE_COLUMNS
  );

  const {
    filterSubsidiary, setFilterSubsidiary,
    filterAssetBook, setFilterAssetBook,
    filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    uniqueSubsidiaries, uniqueAssetBooks, uniqueStatuses,
    activeFilters,
    filteredRecords,
    clearFilters,
    sortKey, sortDirection, toggleSort, sortableColumns,
  } = useMaintenanceFilters(records, searchParams, setSearchParams, () => pagination.resetPage());

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.variant === 'error' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const currentPage = pagination.currentPage;
  const setCurrentPage = pagination.setCurrentPage;
  const itemsPerPage = pagination.itemsPerPage;
  const handlePageSizeChange = pagination.handlePageSizeChange;
  const totalPages = pagination.totalPagesFor(filteredRecords.length);
  const paginatedRecords = pagination.paginate(filteredRecords);

  const selection = useRowSelection();
  const bulkDelete = useBulkDelete({
    getSelectedIds: () => selection.selectedIds,
    getFilteredCount: () => filteredRecords.length,
    hasNoFilters: () =>
      filterSubsidiary.length === 0 && filterAssetBook.length === 0 && filterStatus.length === 0 && !searchQuery,
    deleteAll: onProgress => deleteAllRecords(onProgress),
    deleteMultiple: (ids, onProgress) => deleteMultipleRecords(ids, onProgress),
    clearSelection: selection.clearSelection,
  });

  const activeRecords = records.filter(r => r.status === 'In Progress' || r.status === 'Pending');
  const overdueRecords = records.filter(r => r.status === 'Overdue');

  const totalCost = records.reduce((acc, curr) => {
    const actualStripped = curr.actualCost.replace(/[^0-9.-]+/g, '');
    return acc + parseCost(actualStripped || curr.estimateCost);
  }, 0);

  const formattedCost = formatCurrency(totalCost);

  const setView = (next: MaintenanceView) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    setSearchParams(params, { replace: true });
    pagination.resetPage();
  };

  const handleEdit = (id: string) => {
    setEditingRecordId(id);
    setIsEditModalOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    selection.handleSelectAll(checked, filteredRecords.map(r => r.id));
  };

  const handleToggleExpand = (id: string) => {
    setExpandedRowId(prev => (prev === id ? null : id));
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus(id, newStatus);
      setNotice({ message: `Status updated to "${newStatus}".`, variant: 'success' });
    } catch (err) {
      setNotice({ message: err instanceof Error ? err.message : 'Failed to update status.', variant: 'error' });
      throw err;
    }
  };

  const handleConfirmBulkStatus = async (status: string) => {
    const ids = Array.from(selection.selectedIds);
    if (ids.length === 0) return;
    setIsBulkStatusOpen(false);
    setBulkStatusSaving(true);
    setBulkUpdateProgress({ isOpen: true, status: 'updating', total: ids.length, processed: 0, failedCount: 0 });
    try {
      const { updated, failed } = await bulkUpdateStatus(ids, status, (processed, failedCount) => {
        setBulkUpdateProgress(prev => ({ ...prev, processed, failedCount }));
      });
      setBulkUpdateProgress(prev => ({ ...prev, status: 'done' }));
      selection.clearSelection();
      setNotice(
        failed > 0
          ? { message: `Updated ${updated} records, ${failed} failed`, variant: 'error' }
          : { message: `Updated ${updated} record${updated === 1 ? '' : 's'} to "${status}".`, variant: 'success' }
      );
    } catch (err) {
      setBulkUpdateProgress(prev => ({ ...prev, status: 'done' }));
      setNotice({ message: err instanceof Error ? err.message : 'Bulk update failed.', variant: 'error' });
    } finally {
      setBulkStatusSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const minDelay = new Promise(resolve => setTimeout(resolve, 600));
      await Promise.all([deleteRecord(recordToDelete), minDelay]);
      setRecordToDelete(null);
      setNotice({ message: 'Maintenance record deleted.', variant: 'success' });
    } catch (err) {
      setNotice({ message: err instanceof Error ? err.message : 'Failed to delete record.', variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = useCallback((scope: 'all' | 'selected', columnsScope: 'visible' | 'all') => {
    const source = scope === 'selected'
      ? filteredRecords.filter(r => selection.selectedIds.has(r.id))
      : filteredRecords;
    if (source.length === 0) {
      setNotice({ message: 'No data to export.', variant: 'error' });
      return;
    }
    setIsExporting(true);
    setIsExportMenuOpen(false);
    const columnIds = columnsScope === 'all'
      ? MAINTENANCE_CSV_COLUMN_IDS
      : MAINTENANCE_COLUMNS.filter(c => visibleColumns.has(c.id)).map(c => c.id);
    setTimeout(() => {
      const rows = buildMaintenanceExportRows(source, columnIds, sanitizeCell);
      downloadBlob(
        `Maintenance_${scope === 'selected' ? 'Selected_' : ''}${new Date().toISOString().split('T')[0]}.csv`,
        toCsvBlob(rows),
      );
      setIsExporting(false);
      setNotice({ message: `Exported ${source.length} row${source.length === 1 ? '' : 's'} to CSV`, variant: 'success' });
      logActivity({ actionType: 'EXPORT_REPORT', entityType: 'maintenance', details: { format: 'CSV', count: source.length, scope } });
    }, 0);
  }, [filteredRecords, selection.selectedIds, visibleColumns]);

  const handleKeyboardEscape = useCallback(() => {
    if (expandedRowId !== null) {
      setExpandedRowId(null);
      return;
    }
    if (focusedRowId !== null) {
      setFocusedRowId(null);
      return;
    }
    selection.clearSelection();
  }, [expandedRowId, focusedRowId, selection]);

  const anyModalOpen =
    isModalOpen || isEditModalOpen || recordToDelete !== null || isBulkStatusOpen ||
    bulkDelete.isDeleteModalOpen;

  useMaintenanceKeyboard({
    enabled: view === 'table' && !loading,
    recordIds: paginatedRecords.map(r => r.id),
    focusedRowId,
    onFocusChange: setFocusedRowId,
    onEdit: handleEdit,
    onDelete: setRecordToDelete,
    onEscape: handleKeyboardEscape,
    isModalOpen: anyModalOpen,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const upcomingRecords = records.filter(r => {
    if (r.status === 'Completed' || !r.scheduledDate) return false;
    const scheduled = new Date(r.scheduledDate);
    return scheduled >= today && scheduled <= nextWeek;
  });
  upcomingRecords.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  return (
    <div className="flex flex-col gap-6 w-full">
      <AddMaintenanceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <EditMaintenanceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecordId(null);
        }}
        recordId={editingRecordId}
      />

      <ConfirmModal
        isOpen={recordToDelete !== null}
        title="Delete Record"
        message="Are you sure you want to delete this maintenance record? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isConfirming={isDeleting}
        confirmingLabel="Deleting..."
        onConfirm={confirmDelete}
        onCancel={() => setRecordToDelete(null)}
      />

      <DeleteConfirmModal
        isOpen={bulkDelete.isDeleteModalOpen}
        selectedCount={selection.selectedIds.size}
        confirmText={bulkDelete.deleteConfirmText}
        onConfirmTextChange={bulkDelete.setDeleteConfirmText}
        onCancel={bulkDelete.closeDeleteModal}
        onConfirm={() => {
          bulkDelete.handleConfirmDeleteSelected().then(() => {
            setNotice({ message: 'Selected maintenance records deleted.', variant: 'success' });
          }).catch(err => {
            setNotice({ message: err instanceof Error ? err.message : 'Bulk delete failed.', variant: 'error' });
          });
        }}
        itemLabel="maintenance records"
      />
      <DeleteProgressModal
        deleteProgressModal={bulkDelete.deleteProgress}
        onClose={() => bulkDelete.setDeleteProgress(prev => ({ ...prev, isOpen: false }))}
        itemLabel="maintenance records"
      />
      <MaintenanceBulkStatusModal
        isOpen={isBulkStatusOpen}
        selectedCount={selection.selectedIds.size}
        isSaving={bulkStatusSaving}
        onCancel={() => setIsBulkStatusOpen(false)}
        onConfirm={handleConfirmBulkStatus}
      />
      <BulkUpdateProgressModal
        progress={bulkUpdateProgress}
        onClose={() => setBulkUpdateProgress(prev => ({ ...prev, isOpen: false }))}
        itemLabel="maintenance records"
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Maintenance Overview</h2>
          <p className="text-sm text-on-surface-variant mt-1">Monitor asset health and service schedules across all facilities.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-on-primary px-4 py-2 font-medium rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm whitespace-nowrap"
        >
          <SettingsIcon className="h-4 w-4" /> Add Maintenance Record
        </button>
      </div>

      {loading ? (
        <MaintenanceSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center rounded-xl border border-outline-variant bg-surface-container-lowest">
          <AlertTriangle className="h-10 w-10 text-error" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold text-on-surface">Failed to load maintenance data</p>
            <p className="mt-1 text-sm text-on-surface-variant">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <MaintenanceStats
            activeCount={activeRecords.length}
            overdueCount={overdueRecords.length}
            formattedCost={formattedCost}
            totalCost={totalCost}
            upcomingCount={upcomingRecords.length}
            records={records}
          />

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-bright flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <MaintenanceViewSwitcher activeView={view} onViewChange={setView} />
                <div className="flex flex-wrap items-center gap-2">
                  {view === 'table' && (
                    <ColumnVisibilityDropdown
                      columns={MAINTENANCE_COLUMNS}
                      visibleColumns={visibleColumns}
                      onToggleColumn={toggleColumn}
                      onShowAll={showAllColumns}
                    />
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsExportMenuOpen(prev => !prev)}
                      disabled={isExporting || filteredRecords.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" /> {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                    {isExportMenuOpen && (
                      <div className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-lg">
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-on-surface hover:bg-surface-container-low">
                          <input
                            type="checkbox"
                            checked={exportAllColumns}
                            onChange={e => setExportAllColumns(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-outline-variant text-primary focus:ring-primary"
                          />
                          All columns (ignore visibility)
                        </label>
                        <div className="border-t border-outline-variant" />
                        <button
                          type="button"
                          onClick={() => handleExportCSV('all', exportAllColumns ? 'all' : 'visible')}
                          className="block w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container-low"
                        >
                          Export All (Filtered) · {filteredRecords.length}
                        </button>
                        <button
                          type="button"
                          disabled={selection.selectedIds.size === 0}
                          onClick={() => handleExportCSV('selected', exportAllColumns ? 'all' : 'visible')}
                          className="block w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container-low disabled:opacity-50"
                        >
                          Export Selected · {selection.selectedIds.size}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selection.selectedIds.size > 0 && view === 'table' && (
                <MaintenanceBulkBar
                  selectedCount={selection.selectedIds.size}
                  onDelete={bulkDelete.openDeleteModal}
                  onBulkStatus={() => setIsBulkStatusOpen(true)}
                  onClear={selection.clearSelection}
                />
              )}

              <FilterBar
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                searchPlaceholder="Search by ID or Description..."
                chips={activeFilters}
                onClearFilters={clearFilters}
              >
                <MultiSelectDropdown
                  placeholder="All Subsidiaries"
                  options={uniqueSubsidiaries}
                  selected={filterSubsidiary}
                  onChange={setFilterSubsidiary}
                />
                <MultiSelectDropdown
                  placeholder="All Asset Books"
                  options={uniqueAssetBooks}
                  selected={filterAssetBook}
                  onChange={setFilterAssetBook}
                />
                <MultiSelectDropdown
                  placeholder="All Statuses"
                  options={uniqueStatuses}
                  selected={filterStatus}
                  onChange={setFilterStatus}
                />
              </FilterBar>
            </div>

            {view === 'table' && records.length === 0 ? (
              <MaintenanceEmptyState
                hasActiveFilters={false}
                onClearFilters={clearFilters}
                onAddNew={() => setIsModalOpen(true)}
              />
            ) : view === 'table' ? (
              <>
                <MaintenanceTable
                  records={paginatedRecords}
                  allRecords={records}
                  filteredIds={filteredRecords.map(r => r.id)}
                  visibleColumns={visibleColumns}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onToggleSort={toggleSort}
                  sortableColumns={sortableColumns}
                  selectedIds={selection.selectedIds}
                  onSelectAll={handleSelectAll}
                  onSelectOne={selection.handleSelectOne}
                  onEdit={handleEdit}
                  onDelete={setRecordToDelete}
                  onStatusChange={handleStatusChange}
                  expandedRowId={expandedRowId}
                  onToggleExpand={handleToggleExpand}
                  focusedRowId={focusedRowId}
                  onFocusRow={setFocusedRowId}
                  hasActiveFilters={activeFilters.length > 0}
                  onClearFilters={clearFilters}
                  onAddNew={() => setIsModalOpen(true)}
                />
                <p className="px-4 py-1.5 text-[11px] text-on-surface-variant border-t border-outline-variant/30">
                  ↑↓ navigate · Enter to edit · Delete to remove · Esc to close
                </p>

                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  visibleCount={paginatedRecords.length}
                  totalCount={filteredRecords.length}
                  onPrev={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  onNext={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  onPageChange={setCurrentPage}
                  pageSize={itemsPerPage}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageSizeChange={handlePageSizeChange}
                  itemLabel="records"
                />
              </>
            ) : view === 'calendar' ? (
              <MaintenanceCalendarView records={filteredRecords} onSelectRecord={handleEdit} />
            ) : (
              <MaintenanceTimelineView records={filteredRecords} onSelectRecord={handleEdit} />
            )}
          </div>
        </>
      )}

      <Toast
        message={notice?.message ?? null}
        icon={notice?.variant === 'error' ? <AlertCircle className="h-4 w-4 text-error shrink-0" /> : undefined}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}

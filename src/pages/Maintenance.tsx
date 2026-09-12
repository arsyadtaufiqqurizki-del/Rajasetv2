import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, AlertCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import { formatCurrency, parseCost } from '../lib/money';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useMaintenanceFilters } from '../hooks/useMaintenanceFilters';
import { usePagination } from '../hooks/usePagination';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import AddMaintenanceModal from '../components/AddMaintenanceModal';
import EditMaintenanceModal from '../components/EditMaintenanceModal';
import MaintenanceStats from '../components/MaintenanceStats';
import MaintenanceTable, { MAINTENANCE_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from '../components/MaintenanceTable';
import MaintenanceSkeleton from '../components/MaintenanceSkeleton';
import MaintenanceEmptyState from '../components/MaintenanceEmptyState';
import MaintenanceViewSwitcher, { type MaintenanceView } from '../components/MaintenanceViewSwitcher';
import MaintenanceCalendarView from '../components/MaintenanceCalendarView';
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
  const { records, loading, error, deleteRecord } = useMaintenance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

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
                {view === 'table' && (
                  <ColumnVisibilityDropdown
                    columns={MAINTENANCE_COLUMNS}
                    visibleColumns={visibleColumns}
                    onToggleColumn={toggleColumn}
                    onShowAll={showAllColumns}
                  />
                )}
              </div>

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
                  visibleColumns={visibleColumns}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onToggleSort={toggleSort}
                  sortableColumns={sortableColumns}
                  onEdit={handleEdit}
                  onDelete={setRecordToDelete}
                  hasActiveFilters={activeFilters.length > 0}
                  onClearFilters={clearFilters}
                  onAddNew={() => setIsModalOpen(true)}
                />

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
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <BarChart3 className="h-10 w-10 text-on-surface-variant/50" aria-hidden="true" />
                <p className="text-lg font-semibold text-on-surface">Timeline view</p>
                <p className="text-sm text-on-surface-variant">The horizontal schedule timeline arrives in Phase 3.</p>
              </div>
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

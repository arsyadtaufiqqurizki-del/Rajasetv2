import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { formatCurrency, parseCost } from '../lib/money';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useMaintenanceFilters } from '../hooks/useMaintenanceFilters';
import AddMaintenanceModal from '../components/AddMaintenanceModal';
import EditMaintenanceModal from '../components/EditMaintenanceModal';
import MaintenanceCalendarModal from '../components/MaintenanceCalendarModal';
import MaintenanceStats from '../components/MaintenanceStats';
import MaintenanceTable from '../components/MaintenanceTable';
import MaintenanceSchedulePanel from '../components/MaintenanceSchedulePanel';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';
import ConfirmModal from '../components/ui/ConfirmModal';

export default function Maintenance() {
  const { records, deleteRecord } = useMaintenance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const {
    filterSubsidiary, setFilterSubsidiary,
    filterAssetBook, setFilterAssetBook,
    filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    uniqueSubsidiaries, uniqueAssetBooks, uniqueStatuses,
    activeFilters,
    filteredRecords,
    clearFilters,
  } = useMaintenanceFilters(records, searchParams, setSearchParams, () => setCurrentPage(1));

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const activeRecords = records.filter(r => r.status === 'In Progress' || r.status === 'Pending');
  const overdueRecords = records.filter(r => r.status === 'Overdue');

  const totalCost = records.reduce((acc, curr) => {
    const actualStripped = curr.actualCost.replace(/[^0-9.-]+/g, "");
    return acc + parseCost(actualStripped || curr.estimateCost);
  }, 0);

  const formattedCost = formatCurrency(totalCost);

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
  // Sort upcoming records by date ascending
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
      <MaintenanceCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        records={records}
        onSelectRecord={handleEdit}
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

      <MaintenanceStats
        activeCount={activeRecords.length}
        overdueCount={overdueRecords.length}
        formattedCost={formattedCost}
        totalCost={totalCost}
        upcomingCount={upcomingRecords.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
            <h3 className="text-lg font-semibold text-on-surface">Recent Maintenance Activity</h3>
          </div>

          <FilterBar
            className="p-4 border-b border-outline-variant bg-surface-container-lowest"
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

          <MaintenanceTable
            records={paginatedRecords}
            hasAnyRecords={records.length > 0}
            onEdit={handleEdit}
            onDelete={setRecordToDelete}
          />

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            visibleCount={paginatedRecords.length}
            totalCount={filteredRecords.length}
            onPrev={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            onNext={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          />
        </div>

        <MaintenanceSchedulePanel
          upcomingRecords={upcomingRecords}
          onViewCalendar={() => setIsCalendarModalOpen(true)}
        />
      </div>
    </div>
  );
}

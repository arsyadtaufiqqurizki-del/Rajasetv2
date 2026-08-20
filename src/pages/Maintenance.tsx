import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, AlertTriangle, CircleDollarSign, CalendarDays, MoreVertical, Edit, Trash2, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatCurrency, parseCost } from '../lib/money';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useMaintenanceFilters } from '../hooks/useMaintenanceFilters';
import AddMaintenanceModal from '../components/AddMaintenanceModal';
import EditMaintenanceModal from '../components/EditMaintenanceModal';
import MaintenanceCalendarModal from '../components/MaintenanceCalendarModal';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import FilterBar from '../components/ui/FilterBar';
import Pagination from '../components/ui/Pagination';

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

      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-on-surface mb-2">Delete Record</h2>
            <p className="text-on-surface-variant mb-6">
              Are you sure you want to delete this maintenance record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-error text-on-error px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-sm font-medium mb-3">
            <span>Assets Under Maint.</span>
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div className="text-4xl font-bold text-on-surface mb-2">{activeRecords.length}</div>
          <div className="text-sm text-on-surface-variant">
            {activeRecords.length === 0 ? (
              <span className="text-on-surface-variant font-medium">Belum ada data</span>
            ) : (
              <span>Active service tickets</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-error/30 bg-error-container/20 p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-error-container text-sm font-bold mb-3">
            <span>Overdue Maintenance</span>
            <AlertTriangle className="h-5 w-5 fill-current text-error" />
          </div>
          <div className={cn("text-4xl font-bold mb-2", overdueRecords.length > 0 ? "text-error" : "text-on-surface")}>
            {overdueRecords.length}
          </div>
          <div className="text-sm text-on-error-container">
            {overdueRecords.length === 0 ? "Belum ada data" : "Requires attention"}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-sm font-medium mb-3">
            <span>Total Cost (YTD)</span>
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div className="text-4xl font-bold text-on-surface mb-2">{formattedCost}</div>
          <div className="text-sm text-on-surface-variant">
            {totalCost === 0 ? (
              <span className="text-on-surface-variant font-medium">Belum ada data</span>
            ) : (
              <span>Estimated & Actual</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-sm font-medium mb-3">
            <span>Upcoming This Week</span>
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="text-4xl font-bold text-on-surface mb-2">{upcomingRecords.length}</div>
          <div className="text-sm text-on-surface-variant">
            {upcomingRecords.length === 0 ? "Belum ada data" : "Scheduled maintenance"}
          </div>
        </div>
      </div>

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

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low border-b border-outline-variant whitespace-nowrap">
                <tr>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant text-left">Action</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Book</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Subsidiaries</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Number</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Description</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Units</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Service Type</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Class</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Location</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Estimate Cost</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Actual Cost</th>
                  <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-outline-variant/30">
                {paginatedRecords.length > 0 ? paginatedRecords.map((act) => (
                  <tr key={act.id} className={cn("hover:bg-surface-container-lowest transition-colors whitespace-nowrap", act.status === 'Overdue' ? "bg-error-container/5" : "")}>
                    <td className="py-3 px-4 text-left">
                      <div className="flex items-center justify-start gap-2">
                        <button 
                          onClick={() => handleEdit(act.id)}
                          className="p-1 hover:bg-surface-container-low text-primary rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setRecordToDelete(act.id)}
                          className="p-1 hover:bg-error-container/50 text-error rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">{act.assetBook}</td>
                    <td className="py-3 px-4">{act.subsidiary}</td>
                    <td className={cn("py-3 px-4 font-mono text-xs font-medium", act.status === 'Overdue' ? "text-error" : "text-primary")}>{act.assetNumber}</td>
                    <td className="py-3 px-4">{act.assetDescription}</td>
                    <td className="py-3 px-4">{act.assetUnits}</td>
                    <td className="py-3 px-4">{act.serviceType}</td>
                    <td className="py-3 px-4">{act.assetCategorySegment1}</td>
                    <td className="py-3 px-4">{act.assetCategorySegment2}</td>
                    <td className="py-3 px-4 font-mono text-xs">{act.estimateCost}</td>
                    <td className="py-3 px-4 font-mono text-xs">{act.actualCost}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                        act.status === 'Completed' ? "bg-primary-fixed text-on-primary-fixed border-transparent" :
                        act.status === 'In Progress' ? "bg-secondary-container text-on-secondary-container border-transparent" :
                        act.status === 'Pending' ? "bg-surface-variant text-on-surface-variant border-transparent" :
                        "bg-error-container text-on-error-container border-error/20"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                           act.status === 'Completed' ? "bg-primary" :
                           act.status === 'In Progress' ? "bg-secondary" :
                           act.status === 'Pending' ? "bg-outline" : "bg-error"
                        )} />
                        {act.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-on-surface-variant">
                      {records.length === 0 ? "Belum ada aktivitas maintenance" : "Tidak ada data yang sesuai dengan filter"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            visibleCount={paginatedRecords.length}
            totalCount={filteredRecords.length}
            onPrev={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            onNext={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          />
        </div>

        <div className="lg:col-span-4 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm flex flex-col">
          <div className="p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
            <h3 className="text-lg font-semibold text-on-surface">Maintenance Schedule</h3>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[400px]">
            {upcomingRecords.length === 0 ? (
              <div className="text-on-surface-variant text-center my-auto min-h-[150px] flex items-center justify-center">
                Belum ada jadwal maintenance
              </div>
            ) : (
              upcomingRecords.map(record => (
                <div key={record.id} className="flex gap-4 items-start p-3 rounded-lg border border-outline-variant/50 hover:bg-surface-container-low transition-colors">
                  <div className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-lg p-2 min-w-[56px] text-center">
                    <span className="text-xs font-medium uppercase">{new Date(record.scheduledDate).toLocaleString('default', { month: 'short' })}</span>
                    <span className="text-lg font-bold leading-none">{new Date(record.scheduledDate).getDate()}</span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <h4 className="font-semibold text-on-surface truncate" title={record.assetDescription}>
                      {record.assetDescription}
                    </h4>
                    <p className="text-sm text-on-surface-variant truncate">
                      {record.serviceType}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {record.assetNumber}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {record.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t border-outline-variant text-center mt-auto">
            <button
              onClick={() => setIsCalendarModalOpen(true)}
              className="text-sm font-semibold text-primary hover:underline py-1 w-full"
            >
              View Full Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

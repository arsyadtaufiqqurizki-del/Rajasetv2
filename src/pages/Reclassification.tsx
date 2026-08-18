import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit2, Trash2, Filter, ChevronLeft, ChevronRight, Search, Plus, ClipboardList, CheckCircle2, XCircle, AlertTriangle, Download, CheckCircle, Loader2, RefreshCw, Link2, X } from 'lucide-react';
import { cn, parseListParam } from '../lib/utils';
import { useReclassification } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import Papa from 'papaparse';

// Mencegah CSV injection: field yang diawali =, +, -, @, tab, atau CR akan
// dieksekusi sebagai formula oleh Excel/Sheets kalau tidak dinetralkan.
const sanitizeCsvField = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

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

  const [filterCategory, setFilterCategory] = useState<string[]>(() => parseListParam(searchParams, 'category'));
  const [filterVerified, setFilterVerified] = useState<string[]>(() => parseListParam(searchParams, 'verified'));
  const [filterOwnership, setFilterOwnership] = useState<string[]>(() => parseListParam(searchParams, 'ownership'));
  const [filterAssetCategory, setFilterAssetCategory] = useState<string[]>(() => parseListParam(searchParams, 'assetCategory'));
  const [filterLocation, setFilterLocation] = useState<string[]>(() => parseListParam(searchParams, 'location'));
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => searchParams.get('q') || "");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [deleteProgressModal, setDeleteProgressModal] = useState<{
    isOpen: boolean;
    status: 'deleting' | 'done';
    total: number;
    processed: number;
    failedCount: number;
  }>({
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, filterVerified, filterOwnership, filterAssetCategory, filterLocation, debouncedSearchQuery]);

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterCategory.length > 0) params.set('category', filterCategory.join(','));
    if (filterVerified.length > 0) params.set('verified', filterVerified.join(','));
    if (filterOwnership.length > 0) params.set('ownership', filterOwnership.join(','));
    if (filterAssetCategory.length > 0) params.set('assetCategory', filterAssetCategory.join(','));
    if (filterLocation.length > 0) params.set('location', filterLocation.join(','));
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
    setSearchParams(params, { replace: true });
  }, [filterCategory, filterVerified, filterOwnership, filterAssetCategory, filterLocation, debouncedSearchQuery, setSearchParams]);

  // Union of Asset Inventory's item_statuses lookup with whatever's actually in
  // the data, so filter options stay consistent with Inventory.tsx even if a
  // reclassification row has a category value not yet in the lookup table.
  const uniqueCategories = useMemo(
    () => Array.from(new Set([...itemStatuses, ...reclassifications.map(r => r.category).filter(Boolean)])),
    [itemStatuses, reclassifications]
  );
  const uniqueOwnerships = useMemo(
    () => Array.from(new Set(reclassifications.map(r => r.ownership).filter(Boolean))),
    [reclassifications]
  );
  const uniqueAssetCategories = useMemo(
    () => Array.from(new Set(reclassifications.map(r => r.assetCategory).filter(Boolean))),
    [reclassifications]
  );
  const uniqueLocations = useMemo(
    () => Array.from(new Set(reclassifications.map(r => r.location).filter(Boolean))),
    [reclassifications]
  );

  const activeFilters = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    filterCategory.forEach(v => chips.push({ id: `cat-${v}`, label: `Item Status: ${v}`, onRemove: () => setFilterCategory(prev => prev.filter(x => x !== v)) }));
    filterVerified.forEach(v => chips.push({ id: `verif-${v}`, label: `Verification: ${v}`, onRemove: () => setFilterVerified(prev => prev.filter(x => x !== v)) }));
    filterOwnership.forEach(v => chips.push({ id: `own-${v}`, label: `Ownership: ${v}`, onRemove: () => setFilterOwnership(prev => prev.filter(x => x !== v)) }));
    filterAssetCategory.forEach(v => chips.push({ id: `assetcat-${v}`, label: `Asset Category: ${v}`, onRemove: () => setFilterAssetCategory(prev => prev.filter(x => x !== v)) }));
    filterLocation.forEach(v => chips.push({ id: `loc-${v}`, label: `Location: ${v}`, onRemove: () => setFilterLocation(prev => prev.filter(x => x !== v)) }));
    if (debouncedSearchQuery) {
      chips.push({ id: 'search', label: `Search: "${debouncedSearchQuery}"`, onRemove: () => setSearchQuery("") });
    }
    return chips;
  }, [filterCategory, filterVerified, filterOwnership, filterAssetCategory, filterLocation, debouncedSearchQuery]);

  const stats = useMemo(() => {
    const total = reclassifications.length;
    const verified = reclassifications.filter(r => r.verified).length;
    const unverified = total - verified;
    const needsReview = reclassifications.filter(r => r.category === 'Needs Review').length;
    return { total, verified, unverified, needsReview };
  }, [reclassifications]);

  const filteredItems = useMemo(() => {
    return reclassifications.filter(item => {
      const matchCategory = filterCategory.length === 0 || filterCategory.includes(item.category);
      const matchVerified = filterVerified.length === 0 || filterVerified.includes(item.verified ? 'Yes' : 'No');
      const matchOwnership = filterOwnership.length === 0 || filterOwnership.includes(item.ownership);
      const matchAssetCategory = filterAssetCategory.length === 0 || filterAssetCategory.includes(item.assetCategory);
      const matchLocation = filterLocation.length === 0 || filterLocation.includes(item.location);
      const matchSearch = debouncedSearchQuery
        ? item.assetDescription.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          item.location.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        : true;
      return matchCategory && matchVerified && matchOwnership && matchAssetCategory && matchLocation && matchSearch;
    });
  }, [reclassifications, filterCategory, filterVerified, filterOwnership, filterAssetCategory, filterLocation, debouncedSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const handleExportCSV = useCallback(() => {
    const dataToExport = filteredItems.map(item => ({
      'Asset Category': sanitizeCsvField(item.assetCategory),
      'Asset Description': sanitizeCsvField(item.assetDescription),
      'Location': sanitizeCsvField(item.location),
      'Unit': item.unit,
      'Ownership': sanitizeCsvField(item.ownership),
      'Item Status': sanitizeCsvField(item.category),
      'Remarks': sanitizeCsvField(item.remarks),
      'Verification': item.verified ? 'Yes' : 'No',
      'Verification Date': item.verificationDate,
      'Verified By': sanitizeCsvField(item.verifiedBy),
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Asset_Reclassification_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const handleEdit = useCallback((item: any) => {
    setEditingReclassification(item);
    setIsEditModalOpen(true);
  }, [setEditingReclassification, setIsEditModalOpen]);

  const handleVerify = useCallback((item: any) => {
    setVerifyingReclassification(item);
    setIsVerifyModalOpen(true);
  }, [setVerifyingReclassification, setIsVerifyModalOpen]);

  const handleDelete = useCallback((id: string) => {
    if (window.confirm('Yakin ingin menghapus item reclassification ini?')) {
      deleteReclassification(id);
    }
  }, [deleteReclassification]);

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

  const categoryBadgeClass = (category: string) => {
    if (category === 'Asset') return "bg-emerald-50 border-emerald-200 text-emerald-800";
    if (category === 'Inventory') return "bg-secondary-container/40 border-outline-variant text-on-secondary-container";
    if (category === 'Needs Review') return "bg-amber-50 border-amber-200 text-amber-800";
    return "bg-surface-variant text-on-surface-variant border-outline-variant/50";
  };

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-[180px])] min-h-[600px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Asset Reclassification</h2>
          <p className="text-sm text-on-surface-variant mt-1">Catat dan verifikasi temuan audit fisik aset.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncFromAssets}
            disabled={syncModal.isOpen && syncModal.status === 'syncing'}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Tambahkan asset dari Inventory yang belum tertaut sebagai baseline audit"
          >
            <RefreshCw className="h-4 w-4" />
            Sync from Assets
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Tambah Item
          </button>
          {selectedItems.size > 0 && (
            <button
              onClick={() => {
                setIsDeleteModalOpen(true);
                setDeleteConfirmText("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-error text-on-error rounded-md hover:bg-error/90 font-medium text-sm transition-colors shadow-sm"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedItems.size})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-sm font-medium mb-3">
            <span>Total Item</span>
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div className="text-4xl font-bold text-on-surface mb-2">{stats.total}</div>
          <div className="text-sm text-on-surface-variant">
            {stats.total === 0 ? "Belum ada data" : "Total temuan tercatat"}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-sm font-medium mb-3">
            <span>Verified</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-4xl font-bold text-on-surface mb-2">{stats.verified}</div>
          <div className="text-sm text-on-surface-variant">
            {stats.total === 0 ? "Belum ada data" : `${Math.round((stats.verified / stats.total) * 100)}% dari total`}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-sm font-medium mb-3">
            <span>Unverified</span>
            <XCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-4xl font-bold text-on-surface mb-2">{stats.unverified}</div>
          <div className="text-sm text-on-surface-variant">
            {stats.total === 0 ? "Belum ada data" : "Menunggu verifikasi"}
          </div>
        </div>

        <div className="rounded-xl border border-error/30 bg-error-container/20 p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-error-container text-sm font-bold mb-3">
            <span>Needs Review</span>
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <div className={cn("text-4xl font-bold mb-2", stats.needsReview > 0 ? "text-error" : "text-on-surface")}>
            {stats.needsReview}
          </div>
          <div className="text-sm text-on-error-container">
            {stats.needsReview === 0 ? "Belum ada data" : "Perlu ditinjau ulang"}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-col gap-3 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-xs font-semibold text-on-surface-variant uppercase flex items-center gap-1.5 tracking-wider">
            <Filter className="h-4 w-4" /> Filters
            {activeFilters.length > 0 && (
              <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold normal-case tracking-normal">
                {activeFilters.length}
              </span>
            )}
          </span>
          <div className="flex-1 flex flex-wrap gap-2.5 items-center">
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-on-surface-variant" />
              </div>
              <input
                type="text"
                placeholder="Cari deskripsi atau lokasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-md text-sm py-1.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
              />
            </div>
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
          </div>
          <button
            onClick={() => {
              setFilterCategory([]);
              setFilterVerified([]);
              setFilterOwnership([]);
              setFilterAssetCategory([]);
              setFilterLocation([]);
              setSearchQuery("");
            }}
            className="text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            Clear Filters
          </button>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map(chip => (
              <span
                key={chip.id}
                className="flex items-center gap-1.5 bg-surface-container-high border border-outline-variant rounded-full pl-3 pr-1.5 py-1 text-xs text-on-surface"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="p-0.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-error transition-colors"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0">
              <tr>
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    checked={filteredItems.length > 0 && filteredItems.every(item => selectedItems.has(item.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Actions</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Source</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Description</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Category</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Location</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Unit</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Ownership</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Item Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Remarks</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Verification</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Verification Date</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/30">
              {paginatedItems.length > 0 ? paginatedItems.map(item => (
                <tr key={item.id} className={cn("hover:bg-surface-container-low/50 transition-colors group", selectedItems.has(item.id) && "bg-primary/5")}>
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                        title="Edit Item"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-error hover:border-error transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {item.assetId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md border bg-primary/10 border-primary/30 text-primary whitespace-nowrap">
                        <Link2 className="h-3 w-3" />
                        Linked{item.linkedAssetNumber ? ` (#${item.linkedAssetNumber})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md border bg-surface-variant text-on-surface-variant border-outline-variant/50 whitespace-nowrap">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 font-semibold text-on-surface">{item.assetDescription}</td>
                  <td className="py-4 px-4 text-on-surface">{item.assetCategory || '-'}</td>
                  <td className="py-4 px-4 text-on-surface-variant">{item.location || '-'}</td>
                  <td className="py-4 px-4 text-on-surface-variant">{item.unit || '-'}</td>
                  <td className="py-4 px-4 text-on-surface-variant">{item.ownership || '-'}</td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
                      categoryBadgeClass(item.category)
                    )}>
                      {item.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-on-surface-variant max-w-xs truncate" title={item.remarks}>{item.remarks || '-'}</td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleVerify(item)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors",
                        item.verified
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                          : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                      )}
                    >
                      {item.verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {item.verified ? 'Verified' : 'Unverified'}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-on-surface-variant whitespace-nowrap">
                    {item.verificationDate
                      ? new Date(item.verificationDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-on-surface-variant">Belum ada data reclassification</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-outline-variant bg-surface-container flex items-center justify-between text-sm mt-auto">
          <span className="text-on-surface-variant">Showing {paginatedItems.length} of {filteredItems.length} entries</span>
          <div className="flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
            >
              <ChevronLeft className="h-5 w-5"/>
            </button>
            <span className="px-3 py-1 rounded bg-surface-container-high text-on-surface font-semibold text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest disabled:opacity-50 disabled:hover:text-on-surface-variant"
            >
              <ChevronRight className="h-5 w-5"/>
            </button>
          </div>
        </div>
      </div>

      {/* Sync from Assets Progress Modal */}
      {syncModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              {syncModal.status === 'syncing' ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                    <h3 className="text-xl font-bold text-on-surface">Syncing from Assets...</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-5">
                    Menambahkan asset yang belum tertaut sebagai baseline audit.
                  </p>
                  <div className="mb-2 h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${syncModal.total > 0 ? Math.round((syncModal.processed / syncModal.total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
                    <span>{syncModal.processed} of {syncModal.total} assets processed</span>
                    <span className="font-semibold text-primary">
                      {syncModal.total > 0 ? Math.round((syncModal.processed / syncModal.total) * 100) : 0}%
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    {syncModal.failedCount === 0 ? (
                      <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
                    )}
                    <h3 className="text-xl font-bold text-on-surface">Sync Complete</h3>
                  </div>
                  {syncModal.total === 0 ? (
                    <p className="text-sm text-on-surface-variant mb-4">Semua asset sudah tertaut ke Reclassification.</p>
                  ) : (
                    <div className="bg-surface-container rounded-xl p-4 mb-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Berhasil ditautkan</span>
                        <span className="font-semibold text-emerald-600">{syncModal.successCount} asset</span>
                      </div>
                      {syncModal.failedCount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Gagal</span>
                          <span className="font-semibold text-error">{syncModal.failedCount} asset</span>
                        </div>
                      )}
                    </div>
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
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSyncModal(prev => ({ ...prev, isOpen: false }))}
                      className="px-5 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 font-medium text-sm transition-colors shadow-sm"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Multiple Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-on-surface mb-2">Delete Multiple Items</h3>
              <p className="text-on-surface-variant mb-4 text-sm">
                You are about to delete <strong>{selectedItems.size}</strong> reclassification items. This action is irreversible.
                Please type <strong>DELETE</strong> below to confirm.
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full bg-surface border border-outline-variant rounded-md text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-error focus:border-transparent text-on-surface mb-6"
              />

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (deleteConfirmText === 'DELETE') {
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
                    }
                  }}
                  disabled={deleteConfirmText !== 'DELETE'}
                  className="px-4 py-2 bg-error text-on-error rounded-md hover:bg-error/90 font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Yes, Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Progress Modal */}
      {deleteProgressModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              {deleteProgressModal.status === 'deleting' ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                    <h3 className="text-xl font-bold text-on-surface">Deleting Items...</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-5">
                    Please wait while the selected items are being deleted.
                  </p>
                  <div className="mb-2 h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${deleteProgressModal.total > 0 ? Math.round((deleteProgressModal.processed / deleteProgressModal.total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
                    <span>{deleteProgressModal.processed} of {deleteProgressModal.total} items deleted</span>
                    <span className="font-semibold text-primary">
                      {deleteProgressModal.total > 0 ? Math.round((deleteProgressModal.processed / deleteProgressModal.total) * 100) : 0}%
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    {deleteProgressModal.failedCount === 0 ? (
                      <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
                    )}
                    <h3 className="text-xl font-bold text-on-surface">Delete Complete</h3>
                  </div>
                  <div className="bg-surface-container rounded-xl p-4 mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Successfully deleted</span>
                      <span className="font-semibold text-emerald-600">{deleteProgressModal.processed - deleteProgressModal.failedCount} items</span>
                    </div>
                    {deleteProgressModal.failedCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Failed</span>
                        <span className="font-semibold text-error">{deleteProgressModal.failedCount} items</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setDeleteProgressModal(prev => ({ ...prev, isOpen: false }))}
                      className="px-5 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 font-medium text-sm transition-colors shadow-sm"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

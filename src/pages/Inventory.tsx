import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logActivity } from '../lib/activityLogger';
import { Eye, Edit2, Trash2, Calendar, Filter, ChevronLeft, ChevronRight, Search, Upload, Download, FileDown, CheckCircle, XCircle, Loader2, Plus, X } from 'lucide-react';
import { cn, formatCurrency, parseListParam } from '../lib/utils';
import { useAsset } from '../contexts/AssetContext';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import Papa from 'papaparse';

export default function Inventory() {
  const { assets, deleteAsset, deleteMultipleAssets, deleteAllAssets, setEditingAsset, setIsEditModalOpen, setIsAddModalOpen, subsidiaries, categories1, categories2, itemStatuses, addAsset } = useAsset();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterSubsidiary, setFilterSubsidiary] = useState<string[]>(() => parseListParam(searchParams, 'subsidiary'));
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string[]>(() => parseListParam(searchParams, 'category'));
  const [filterLocation, setFilterLocation] = useState<string[]>(() => parseListParam(searchParams, 'location'));
  const [filterStatus, setFilterStatus] = useState<string[]>(() => parseListParam(searchParams, 'status'));
  const [filterVerification, setFilterVerification] = useState<string[]>(() => parseListParam(searchParams, 'verification'));
  const [filterItemStatus, setFilterItemStatus] = useState<string[]>(() => parseListParam(searchParams, 'itemStatus'));
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') || "");
  const [costMin, setCostMin] = useState(() => searchParams.get('costMin') || "");
  const [costMax, setCostMax] = useState(() => searchParams.get('costMax') || "");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => searchParams.get('q') || "");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
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

  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    status: 'importing' | 'done';
    total: number;
    processed: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    invalidRows: { rowNumber: number; assetNumber: string; assetDescription: string; reason: string }[];
  }>({
    isOpen: false,
    status: 'importing',
    total: 0,
    processed: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    invalidRows: [],
  });

  const uniqueStatuses = useMemo(() => Array.from(new Set(assets.map(a => a.status).filter(Boolean))), [assets]);

  const activeFilters = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    filterSubsidiary.forEach(v => chips.push({ id: `sub-${v}`, label: `Subsidiary: ${v}`, onRemove: () => setFilterSubsidiary(prev => prev.filter(x => x !== v)) }));
    filterCategory.forEach(v => chips.push({ id: `cat-${v}`, label: `Asset Class: ${v}`, onRemove: () => setFilterCategory(prev => prev.filter(x => x !== v)) }));
    filterLocation.forEach(v => chips.push({ id: `loc-${v}`, label: `Location: ${v}`, onRemove: () => setFilterLocation(prev => prev.filter(x => x !== v)) }));
    filterStatus.forEach(v => chips.push({ id: `status-${v}`, label: `Status: ${v}`, onRemove: () => setFilterStatus(prev => prev.filter(x => x !== v)) }));
    filterVerification.forEach(v => chips.push({ id: `verif-${v}`, label: `Verification: ${v}`, onRemove: () => setFilterVerification(prev => prev.filter(x => x !== v)) }));
    filterItemStatus.forEach(v => chips.push({ id: `itemstatus-${v}`, label: `Item Status: ${v}`, onRemove: () => setFilterItemStatus(prev => prev.filter(x => x !== v)) }));
    if (dateFrom || dateTo) {
      chips.push({ id: 'date', label: `Date: ${dateFrom || '…'} → ${dateTo || '…'}`, onRemove: () => { setDateFrom(""); setDateTo(""); } });
    }
    if (costMin || costMax) {
      chips.push({ id: 'cost', label: `Cost: ${costMin || '0'} - ${costMax || '∞'}`, onRemove: () => { setCostMin(""); setCostMax(""); } });
    }
    if (debouncedSearchQuery) {
      chips.push({ id: 'search', label: `Search: "${debouncedSearchQuery}"`, onRemove: () => setSearchQuery("") });
    }
    return chips;
  }, [filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery]);

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterSubsidiary.length > 0) params.set('subsidiary', filterSubsidiary.join(','));
    if (filterCategory.length > 0) params.set('category', filterCategory.join(','));
    if (filterLocation.length > 0) params.set('location', filterLocation.join(','));
    if (filterStatus.length > 0) params.set('status', filterStatus.join(','));
    if (filterVerification.length > 0) params.set('verification', filterVerification.join(','));
    if (filterItemStatus.length > 0) params.set('itemStatus', filterItemStatus.join(','));
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (costMin) params.set('costMin', costMin);
    if (costMax) params.set('costMax', costMax);
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
    setSearchParams(params, { replace: true });
  }, [filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery, setSearchParams]);

  const filteredAssets = useMemo(() => {
    const min = costMin === "" ? null : parseFloat(costMin);
    const max = costMax === "" ? null : parseFloat(costMax);
    return assets.filter(asset => {
      const matchSubsidiary = filterSubsidiary.length === 0 || filterSubsidiary.includes(asset.subsidiary);
      const matchCategory = filterCategory.length === 0 || filterCategory.includes(asset.categorySegment1);
      const matchLocation = filterLocation.length === 0 || filterLocation.includes(asset.categorySegment2);
      const matchStatus = filterStatus.length === 0 || filterStatus.includes(asset.status);
      const matchVerification = filterVerification.length === 0 || filterVerification.includes(asset.verification ? 'Yes' : 'No');
      const matchItemStatus = filterItemStatus.length === 0 || filterItemStatus.includes(asset.itemStatus);
      const matchDateFrom = dateFrom === "" || asset.datePlaceInService >= dateFrom;
      const matchDateTo = dateTo === "" || asset.datePlaceInService <= dateTo;
      const cost = parseFloat(asset.assetCost.replace(/[^0-9.-]+/g, "")) || 0;
      const matchCostMin = min === null || cost >= min;
      const matchCostMax = max === null || cost <= max;
      const matchSearch = debouncedSearchQuery
        ? asset.assetDescription.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          asset.assetNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        : true;
      return matchSubsidiary && matchCategory && matchLocation && matchStatus && matchVerification && matchItemStatus && matchDateFrom && matchDateTo && matchCostMin && matchCostMax && matchSearch;
    });
  }, [assets, filterSubsidiary, filterCategory, filterLocation, filterStatus, filterVerification, filterItemStatus, dateFrom, dateTo, costMin, costMax, debouncedSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / itemsPerPage));
  
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAssets.slice(start, start + itemsPerPage);
  }, [filteredAssets, currentPage]);

  const handleEditAsset = useCallback((asset: any) => {
    setEditingAsset(asset);
    setIsEditModalOpen(true);
  }, [setEditingAsset, setIsEditModalOpen]);

  const handleDeleteAsset = useCallback((assetId: string) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      deleteAsset(assetId);
    }
  }, [deleteAsset]);

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

  const handleExportCSV = useCallback(() => {
    const dataToExport = filteredAssets.map(asset => ({
      'Asset Number': asset.assetNumber,
      'Asset Description': asset.assetDescription,
      'Asset Book': asset.assetBook,
      'Subsidiary': asset.subsidiary,
      'Asset Cost': asset.assetCost,
      'Date Place In Service': asset.datePlaceInService,
      'Asset Units': asset.assetUnits,
      'Asset Category Segment 1': asset.categorySegment1,
      'Asset Category Segment 2': asset.categorySegment2,
      'Depreciation Method': asset.depreciationMethod,
      'Life in Months': asset.lifeInMonths,
      'Listed': asset.listed,
      'Status': asset.status,
      'Verification': asset.verification ? 'Yes' : 'No',
      'Verification Date': asset.verificationDate,
      'Item Status': asset.itemStatus
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Asset_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredAssets]);

  const handleImportCSV = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];

        if (data.length > 5000) {
          alert(`File exceeds the maximum limit of 5000 rows. Your file has ${data.length} rows. Please split your file and try again.`);
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
        alert('Error parsing CSV file: ' + error.message);
      }
    });
  }, [addAsset]);

  const handleDownloadInvalidRows = useCallback(() => {
    const rows = importModal.invalidRows;
    if (rows.length === 0) return;
    const csv = [
      ['Row Number', 'Asset Number', 'Asset Description', 'Reason'],
      ...rows.map(r => [r.rowNumber, r.assetNumber, r.assetDescription, r.reason]),
    ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invalid_rows.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [importModal.invalidRows]);

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-[180px])] min-h-[600px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Asset Inventory</h2>
          <p className="text-sm text-on-surface-variant mt-1">Manage and track enterprise assets across all subsidiaries.</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleImportCSV} 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importModal.isOpen && importModal.status === 'importing'}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <a
            href="/asset_import_template.csv"
            download="asset_import_template.csv"
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm"
          >
            <FileDown className="h-4 w-4" />
            Download Template
          </a>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:opacity-90 font-medium text-sm transition-opacity shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add New Asset
          </button>
          {selectedAssets.size > 0 && (
            <button
              onClick={() => {
                setIsDeleteModalOpen(true);
                setDeleteConfirmText("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-error text-on-error rounded-md hover:bg-error/90 font-medium text-sm transition-colors shadow-sm"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedAssets.size})
            </button>
          )}
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
                placeholder="Search by ID or Description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-md text-sm py-1.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
              />
            </div>
            <MultiSelectDropdown
              placeholder="All Subsidiaries"
              options={subsidiaries}
              selected={filterSubsidiary}
              onChange={setFilterSubsidiary}
            />
            <MultiSelectDropdown
              placeholder="All Asset Classes"
              options={categories1}
              selected={filterCategory}
              onChange={setFilterCategory}
            />
            <MultiSelectDropdown
              placeholder="All Locations"
              options={categories2}
              selected={filterLocation}
              onChange={setFilterLocation}
            />
            <MultiSelectDropdown
              placeholder="All Statuses"
              options={uniqueStatuses}
              selected={filterStatus}
              onChange={setFilterStatus}
            />
            <MultiSelectDropdown
              placeholder="All Verification"
              options={['Yes', 'No']}
              selected={filterVerification}
              onChange={setFilterVerification}
            />
            <MultiSelectDropdown
              placeholder="All Item Statuses"
              options={itemStatuses}
              selected={filterItemStatus}
              onChange={setFilterItemStatus}
            />
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Date place in service from"
                className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
              />
              <span className="text-xs text-on-surface-variant">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Date place in service to"
                className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min cost"
                value={costMin}
                onChange={(e) => setCostMin(e.target.value)}
                className="w-28 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
              />
              <span className="text-xs text-on-surface-variant">-</span>
              <input
                type="number"
                placeholder="Max cost"
                value={costMax}
                onChange={(e) => setCostMax(e.target.value)}
                className="w-28 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setFilterSubsidiary([]);
              setFilterCategory([]);
              setFilterLocation([]);
              setFilterStatus([]);
              setFilterVerification([]);
              setFilterItemStatus([]);
              setDateFrom("");
              setDateTo("");
              setCostMin("");
              setCostMax("");
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
                    checked={filteredAssets.length > 0 && filteredAssets.every(a => selectedAssets.has(a.id))}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Actions</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Book</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Subsidiaries</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Number</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Description</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider text-right">Asset Cost</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Date Place in Service</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Units</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Class</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Location</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Depreciation Method</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Life in Months</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Listed</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Verification</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Verification Date</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Item Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/30">
              {paginatedAssets.length > 0 ? paginatedAssets.map((asset, i) => (
                <tr key={asset.id} className={cn("hover:bg-surface-container-low/50 transition-colors group", selectedAssets.has(asset.id) && "bg-primary/5")}>
                  <td className="py-4 px-4 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      checked={selectedAssets.has(asset.id)}
                      onChange={(e) => handleSelectAsset(asset.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditAsset(asset)}
                        className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                        title="Edit Asset"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-error hover:border-error transition-colors"
                        title="Delete Asset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-secondary text-xs">{asset.assetBook || asset.id}</td>
                  <td className="py-4 px-4 text-on-surface text-xs">{asset.subsidiary}</td>
                  <td className="py-4 px-4 font-mono text-on-surface text-xs">{asset.assetNumber}</td>
                  <td className="py-4 px-4 font-semibold text-on-surface">{asset.assetDescription}</td>
                  <td className="py-4 px-4 text-on-surface-variant text-right font-mono tabular-nums">{formatCurrency(asset.assetCost)}</td>
                  <td className="py-4 px-4 text-on-surface font-mono text-xs">{asset.datePlaceInService}</td>
                  <td className="py-4 px-4 text-on-surface-variant">{asset.assetUnits}</td>
                  <td className="py-4 px-4 text-on-surface">{asset.categorySegment1}</td>
                  <td className="py-4 px-4 text-on-surface">{asset.categorySegment2}</td>
                  <td className="py-4 px-4 text-on-surface-variant">{asset.depreciationMethod}</td>
                  <td className="py-4 px-4 text-on-surface text-center">{asset.lifeInMonths}</td>
                  <td className="py-4 px-4 text-on-surface-variant">{asset.listed}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
                      asset.statusLevel === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                      asset.statusLevel === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" : 
                      asset.statusLevel === 'error' ? "bg-error-container/40 border-error/20 text-on-error-container" :
                      "bg-surface-variant text-on-surface-variant border-outline-variant/50"
                    )}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
                      asset.verification ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-surface-variant text-on-surface-variant border-outline-variant/50"
                    )}>
                      {asset.verification ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-on-surface font-mono text-xs">{asset.verificationDate}</td>
                  <td className="py-4 px-4 text-on-surface-variant">{asset.itemStatus}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={18} className="py-8 text-center text-on-surface-variant">Belum ada data asset</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 border-t border-outline-variant bg-surface-container flex items-center justify-between text-sm mt-auto">
          <span className="text-on-surface-variant">Showing {paginatedAssets.length} of {filteredAssets.length} entries</span>
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

      {/* CSV Import Progress Modal */}
      {importModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              {importModal.status === 'importing' ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                    <h3 className="text-xl font-bold text-on-surface">Importing Assets...</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-5">
                    Please wait while your CSV file is being processed.
                  </p>
                  <div className="mb-2 h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${importModal.total > 0 ? Math.round((importModal.processed / importModal.total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
                    <span>{importModal.processed} of {importModal.total} assets processed</span>
                    <span className="font-semibold text-primary">
                      {importModal.total > 0 ? Math.round((importModal.processed / importModal.total) * 100) : 0}%
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    {importModal.failedCount === 0 ? (
                      <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
                    )}
                    <h3 className="text-xl font-bold text-on-surface">Import Complete</h3>
                  </div>
                  <div className="bg-surface-container rounded-xl p-4 mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Successfully imported</span>
                      <span className="font-semibold text-emerald-600">{importModal.successCount} assets</span>
                    </div>
                    {importModal.failedCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Failed</span>
                        <span className="font-semibold text-error">{importModal.failedCount} assets</span>
                      </div>
                    )}
                    {importModal.skippedCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Skipped (invalid rows)</span>
                        <span className="font-semibold text-amber-600">{importModal.skippedCount} rows</span>
                      </div>
                    )}
                  </div>

                  {importModal.invalidRows.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                          Baris yang dilewati
                        </span>
                        <button
                          onClick={handleDownloadInvalidRows}
                          className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Download CSV
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-outline-variant text-xs">
                        <table className="w-full">
                          <thead className="bg-surface-container sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Baris</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Asset Number</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Alasan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importModal.invalidRows.map((row, i) => (
                              <tr key={i} className="border-t border-outline-variant/50">
                                <td className="px-3 py-1.5 text-on-surface-variant">{row.rowNumber}</td>
                                <td className="px-3 py-1.5 text-on-surface">{row.assetNumber || <span className="italic text-on-surface-variant">—</span>}</td>
                                <td className="px-3 py-1.5 text-amber-600">{row.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
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
              <h3 className="text-xl font-bold text-on-surface mb-2">Delete Multiple Assets</h3>
              <p className="text-on-surface-variant mb-4 text-sm">
                You are about to delete <strong>{selectedAssets.size}</strong> assets. This action is irreversible.
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
                    <h3 className="text-xl font-bold text-on-surface">Deleting Assets...</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant mb-5">
                    Please wait while the selected assets are being deleted.
                  </p>
                  <div className="mb-2 h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${deleteProgressModal.total > 0 ? Math.round((deleteProgressModal.processed / deleteProgressModal.total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-on-surface-variant mt-1.5">
                    <span>{deleteProgressModal.processed} of {deleteProgressModal.total} assets deleted</span>
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
                      <span className="font-semibold text-emerald-600">{deleteProgressModal.processed - deleteProgressModal.failedCount} assets</span>
                    </div>
                    {deleteProgressModal.failedCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Failed</span>
                        <span className="font-semibold text-error">{deleteProgressModal.failedCount} assets</span>
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

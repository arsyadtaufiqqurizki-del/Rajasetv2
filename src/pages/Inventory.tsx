import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Eye, Edit2, Trash2, Calendar, Filter, ChevronLeft, ChevronRight, Search, Upload, Download, FileDown, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAsset } from '../contexts/AssetContext';
import Papa from 'papaparse';

export default function Inventory() {
  const { assets, deleteAsset, deleteMultipleAssets, setEditingAsset, setIsEditModalOpen, subsidiaries, categories1, addAsset } = useAsset();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [filterSubsidiary, setFilterSubsidiary] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [importModal, setImportModal] = useState({
    isOpen: false,
    status: 'importing' as 'importing' | 'done',
    total: 0,
    processed: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
  });

  const uniqueStatuses = useMemo(() => Array.from(new Set(assets.map(a => a.status).filter(Boolean))), [assets]);

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
  }, [filterSubsidiary, filterCategory, filterStatus, debouncedSearchQuery]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchSubsidiary = filterSubsidiary ? asset.subsidiary === filterSubsidiary : true;
      const matchCategory = filterCategory ? asset.categorySegment1 === filterCategory : true;
      const matchStatus = filterStatus ? asset.status === filterStatus : true;
      const matchSearch = debouncedSearchQuery 
        ? asset.assetDescription.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
          asset.assetNumber.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        : true;
      return matchSubsidiary && matchCategory && matchStatus && matchSearch;
    });
  }, [assets, filterSubsidiary, filterCategory, filterStatus, debouncedSearchQuery]);

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
      'Asset Book': asset.assetBook,
      'Subsidiary': asset.subsidiary,
      'Asset Number': asset.assetNumber,
      'Asset Description': asset.assetDescription,
      'Asset Cost': asset.assetCost,
      'Date Place In Service': asset.datePlaceInService,
      'Asset Units': asset.assetUnits,
      'Asset Category Segment 1': asset.categorySegment1,
      'Asset Category Segment 2': asset.categorySegment2,
      'Depreciation Method': asset.depreciationMethod,
      'Life in Months': asset.lifeInMonths,
      'Listed': asset.listed,
      'Status': asset.status
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

        const validRows = data.filter(row => {
          const assetNumber = row['Asset Number'] || row['assetNumber'];
          const assetDescription = row['Asset Description'] || row['assetDescription'];
          return assetNumber && assetDescription;
        });
        const skippedCount = data.length - validRows.length;

        setImportModal({
          isOpen: true,
          status: 'importing',
          total: validRows.length,
          processed: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount,
        });

        const BATCH_SIZE = 10;
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
            })
            .then(() => {
              setImportModal(prev => ({
                ...prev,
                processed: prev.processed + 1,
                successCount: prev.successCount + 1,
              }));
            })
            .catch(() => {
              setImportModal(prev => ({
                ...prev,
                processed: prev.processed + 1,
                failedCount: prev.failedCount + 1,
              }));
            });
          }));
        }

        setImportModal(prev => ({ ...prev, status: 'done' }));
        if (event.target) event.target.value = '';
      },
      error: (error) => {
        alert('Error parsing CSV file: ' + error.message);
      }
    });
  }, [addAsset]);

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

      <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-wrap gap-4 items-center shadow-sm">
        <span className="text-xs font-semibold text-on-surface-variant uppercase flex items-center gap-1.5 tracking-wider">
          <Filter className="h-4 w-4" /> Filters
        </span>
        <div className="flex-1 flex flex-wrap gap-2.5">
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
          <select 
            value={filterSubsidiary}
            onChange={(e) => setFilterSubsidiary(e.target.value)}
            className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">All Subsidiaries</option>
            {subsidiaries.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[140px] focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories1.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[140px] focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => {
            setFilterSubsidiary("");
            setFilterCategory("");
            setFilterStatus("");
            setSearchQuery("");
          }}
          className="text-sm font-medium text-secondary hover:text-primary transition-colors"
        >
          Clear Filters
        </button>
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
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Cost</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Date Place in Service</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Units</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Category Segment 1</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Category Segment 2</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Depreciation Method</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Life in Months</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Listed</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Status</th>
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
                  <td className="py-4 px-4 text-on-surface-variant">{asset.assetCost}</td>
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
                </tr>
              )) : (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-on-surface-variant">Belum ada data asset</td>
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
                  <div className="bg-surface-container rounded-xl p-4 mb-6 space-y-2 text-sm">
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
                        <span className="font-semibold text-on-surface-variant">{importModal.skippedCount} rows</span>
                      </div>
                    )}
                  </div>
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
              {selectedAssets.size > 100 && (
                <p className="text-on-surface-variant mb-4 text-xs bg-surface-container rounded-md px-3 py-2">
                  Data sebanyak {selectedAssets.size} aset akan diproses dalam {Math.ceil(selectedAssets.size / 100)} batch. Proses ini mungkin memakan beberapa detik.
                </p>
              )}
              
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
                  disabled={isDeleting}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (deleteConfirmText === 'DELETE') {
                      setIsDeleting(true);
                      await deleteMultipleAssets(Array.from(selectedAssets));
                      setSelectedAssets(new Set());
                      setIsDeleteModalOpen(false);
                      setDeleteConfirmText('');
                      setIsDeleting(false);
                    }
                  }}
                  disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  className="px-4 py-2 bg-error text-on-error rounded-md hover:bg-error/90 font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete All'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

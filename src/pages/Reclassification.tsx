import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Edit2, Trash2, Filter, ChevronLeft, ChevronRight, Search, Plus, ClipboardList, CheckCircle2, XCircle, AlertTriangle, Upload, Download, FileDown, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useReclassification } from '../contexts/ReclassificationContext';
import { logActivity } from '../lib/activityLogger';
import Papa from 'papaparse';

// Mencegah CSV injection: field yang diawali =, +, -, @, tab, atau CR akan
// dieksekusi sebagai formula oleh Excel/Sheets kalau tidak dinetralkan.
const sanitizeCsvField = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

export default function Reclassification() {
  const {
    reclassifications, deleteReclassification, addReclassification,
    setEditingReclassification, setIsEditModalOpen,
    setVerifyingReclassification, setIsVerifyModalOpen,
    setIsAddModalOpen,
  } = useReclassification();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterCategory, setFilterCategory] = useState("");
  const [filterVerified, setFilterVerified] = useState("");
  const [filterOwnership, setFilterOwnership] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    status: 'importing' | 'done';
    total: number;
    processed: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    invalidRows: { rowNumber: number; assetDescription: string; reason: string }[];
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, filterVerified, filterOwnership, debouncedSearchQuery]);

  const uniqueCategories = useMemo(
    () => Array.from(new Set(reclassifications.map(r => r.category).filter(Boolean))),
    [reclassifications]
  );
  const uniqueOwnerships = useMemo(
    () => Array.from(new Set(reclassifications.map(r => r.ownership).filter(Boolean))),
    [reclassifications]
  );

  const stats = useMemo(() => {
    const total = reclassifications.length;
    const verified = reclassifications.filter(r => r.verified).length;
    const unverified = total - verified;
    const needsReview = reclassifications.filter(r => r.category === 'Needs Review').length;
    return { total, verified, unverified, needsReview };
  }, [reclassifications]);

  const filteredItems = useMemo(() => {
    return reclassifications.filter(item => {
      const matchCategory = filterCategory ? item.category === filterCategory : true;
      const matchVerified = filterVerified
        ? (filterVerified === 'verified' ? item.verified : !item.verified)
        : true;
      const matchOwnership = filterOwnership ? item.ownership === filterOwnership : true;
      const matchSearch = debouncedSearchQuery
        ? item.assetDescription.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          item.location.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        : true;
      return matchCategory && matchVerified && matchOwnership && matchSearch;
    });
  }, [reclassifications, filterCategory, filterVerified, filterOwnership, debouncedSearchQuery]);

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
      'Category': sanitizeCsvField(item.category),
      'Verified': item.verified ? 'Yes' : 'No',
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
        const invalidRows: { rowNumber: number; assetDescription: string; reason: string }[] = [];

        data.forEach((row, index) => {
          const assetDescription = row['Asset Description'] || row['assetDescription'] || '';
          if (!assetDescription) {
            invalidRows.push({
              rowNumber: index + 2, // +2 karena baris 1 = header
              assetDescription,
              reason: 'Asset Description kosong',
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
            const assetDescription = row['Asset Description'] || row['assetDescription'];
            return addReclassification({
              assetCategory: row['Asset Category'] || row['assetCategory'] || '',
              assetDescription,
              location: row['Location'] || row['location'] || '',
              unit: row['Unit'] || row['unit'] || '',
              ownership: row['Ownership'] || row['ownership'] || '',
              category: row['Category'] || row['category'] || 'Needs Review',
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
        logActivity({ actionType: 'IMPORT_CSV', entityType: 'reclassification', details: { total: validRows.length + invalidRows.length, success: localSuccess, failed: localFailed + invalidRows.length } });
        if (event.target) event.target.value = '';
      },
      error: (error) => {
        alert('Error parsing CSV file: ' + error.message);
      }
    });
  }, [addReclassification]);

  const handleDownloadInvalidRows = useCallback(() => {
    const rows = importModal.invalidRows;
    if (rows.length === 0) return;
    const csv = [
      ['Row Number', 'Asset Description', 'Reason'],
      ...rows.map(r => [r.rowNumber, sanitizeCsvField(r.assetDescription), r.reason]),
    ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invalid_rows.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [importModal.invalidRows]);

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
            href="/reclassification_import_template.csv"
            download="reclassification_import_template.csv"
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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary/90 font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Tambah Item
          </button>
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
              placeholder="Cari deskripsi atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-md text-sm py-1.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">Semua Category</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value)}
            className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
          <select
            value={filterOwnership}
            onChange={(e) => setFilterOwnership(e.target.value)}
            className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">Semua Ownership</option>
            {uniqueOwnerships.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setFilterCategory("");
            setFilterVerified("");
            setFilterOwnership("");
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
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Actions</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Description</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Category</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Location</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Unit</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Ownership</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Category</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Verification Date</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-outline-variant/30">
              {paginatedItems.length > 0 ? paginatedItems.map(item => (
                <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors group">
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
                  <td colSpan={9} className="py-8 text-center text-on-surface-variant">Belum ada data reclassification</td>
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

      {/* CSV Import Progress Modal */}
      {importModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              {importModal.status === 'importing' ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                    <h3 className="text-xl font-bold text-on-surface">Importing Reclassifications...</h3>
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
                    <span>{importModal.processed} of {importModal.total} items processed</span>
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
                      <span className="font-semibold text-emerald-600">{importModal.successCount} items</span>
                    </div>
                    {importModal.failedCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Failed</span>
                        <span className="font-semibold text-error">{importModal.failedCount} items</span>
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
                              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Asset Description</th>
                              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Alasan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importModal.invalidRows.map((row, i) => (
                              <tr key={i} className="border-t border-outline-variant/50">
                                <td className="px-3 py-1.5 text-on-surface-variant">{row.rowNumber}</td>
                                <td className="px-3 py-1.5 text-on-surface">{row.assetDescription || <span className="italic text-on-surface-variant">—</span>}</td>
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
    </div>
  );
}

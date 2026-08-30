import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Download, FileText, History, Table2 } from 'lucide-react';
import { useAsset } from '../contexts/AssetContext';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useReport } from '../contexts/ReportContext';
import type { ReportRecord } from '../contexts/ReportContext';
import { useAuth } from '../contexts/AuthContext';
import { useReportFilters } from '../hooks/useReportFilters';
import { REPORT_TYPES, type DetailColumn, type ReportPreview, type ReportType } from '../types/report';
import {
  buildValuationReport, buildDepreciationReport, buildMaintenanceCostReport,
  exportReportPdf, exportReportXlsx, exportReportCsv,
} from '../lib/reports';
import { logActivity } from '../lib/activityLogger';
import ReportFilterBar from '../components/reports/ReportFilterBar';
import ReportChart from '../components/reports/ReportChart';
import ReportSummaryCards from '../components/reports/ReportSummaryCards';
import ReportDetailTable from '../components/reports/ReportDetailTable';
import ReportHistoryTable from '../components/reports/ReportHistoryTable';
import ConfirmModal from '../components/ui/ConfirmModal';
import Toast from '../components/ui/Toast';
import { en as copy } from '../i18n/en';

const t = copy.reports;

function matchesMulti(value: string, selected: string[]) {
  return selected.length === 0 || selected.includes(value);
}

function describeSelection(values: string[]): string {
  if (values.length === 0) return 'All Divisions';
  if (values.length <= 2) return values.join(', ');
  return `${values.length} Subsidiaries`;
}

export default function Reports() {
  const { assets, subsidiaries, categories1, categories2 } = useAsset();
  const { records } = useMaintenance();
  const { reportHistory, loading, error, page, totalPages, totalCount, setPage, saveReport, deleteReport } = useReport();
  const { userName } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const chartRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  const {
    reportType, setReportType,
    filterSubsidiary, setFilterSubsidiary,
    filterCategory, setFilterCategory,
    filterLocation, setFilterLocation,
    filterStatus, setFilterStatus,
    datePreset, setDatePreset,
    dateStart, setDateStart,
    dateEnd, setDateEnd,
    dateError,
    chips,
    clearFilters,
  } = useReportFilters(searchParams, setSearchParams);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    assets.forEach(a => { if (a.status) set.add(a.status); });
    records.forEach(r => { if (r.status) set.add(r.status); });
    return Array.from(set).sort();
  }, [assets, records]);

  const filteredAssets = useMemo(() => assets.filter(a =>
    matchesMulti(a.subsidiary, filterSubsidiary) &&
    matchesMulti(a.categorySegment1, filterCategory) &&
    matchesMulti(a.categorySegment2, filterLocation) &&
    matchesMulti(a.status, filterStatus)
  ), [assets, filterSubsidiary, filterCategory, filterLocation, filterStatus]);

  const filteredRecords = useMemo(() => records.filter(r =>
    matchesMulti(r.subsidiary, filterSubsidiary) &&
    matchesMulti(r.assetCategorySegment1, filterCategory) &&
    matchesMulti(r.assetCategorySegment2, filterLocation) &&
    matchesMulti(r.status, filterStatus)
  ), [records, filterSubsidiary, filterCategory, filterLocation, filterStatus]);

  const [livePreviewData, setLivePreviewData] = useState<ReportPreview | null>(null);
  const [liveGeneratedAt, setLiveGeneratedAt] = useState<Date | null>(null);
  const [snapshotView, setSnapshotView] = useState<ReportRecord | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.variant === 'error' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Cleared then reset a tick later so a screen reader re-announces the same message
  // (e.g. reviewing the same report twice in a row) instead of treating it as unchanged.
  const announce = (message: string) => {
    setLiveMessage('');
    setTimeout(() => setLiveMessage(message), 50);
  };

  const subsidiaryLabel = describeSelection(filterSubsidiary);

  // Whatever is on screen — either the live preview just reviewed, or an archived
  // snapshot opened from history. Export/save actions read from these, never from
  // livePreviewData/filter state directly, so opening a snapshot exports and labels
  // exactly what was saved, not whatever the filter bar currently holds.
  const previewData = snapshotView ? snapshotView.reportData : livePreviewData;
  const generatedAt = snapshotView ? new Date(snapshotView.createdAt) : liveGeneratedAt;
  const displayReportType = snapshotView ? snapshotView.reportType : reportType;
  const displaySubsidiary = snapshotView ? snapshotView.subsidiary : subsidiaryLabel;
  const displayDateStart = snapshotView ? snapshotView.dateStart : dateStart;
  const displayDateEnd = snapshotView ? snapshotView.dateEnd : dateEnd;
  const displayGeneratedBy = snapshotView ? snapshotView.userName : (userName ?? 'Unknown User');

  const handleReview = async () => {
    if (dateError) return;
    setGenerating(true);
    setSavedSnapshot(false);
    setSnapshotView(null);
    // Yield one tick so the "Reviewing..." state actually paints before the
    // synchronous builder (esp. Depreciation Schedule) blocks the main thread.
    await new Promise(resolve => setTimeout(resolve, 0));

    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    const generated: ReportPreview =
      reportType === 'Asset Valuation Summary' ? buildValuationReport(filteredAssets, start, end) :
      reportType === 'Depreciation Schedule' ? buildDepreciationReport(filteredAssets, start, end) :
      buildMaintenanceCostReport(filteredRecords, start, end);

    setLivePreviewData(generated);
    setLiveGeneratedAt(new Date());
    setGenerating(false);
    announce(`${t.a11y.previewReadyPrefix}: ${generated.detailData.length.toLocaleString()} rows`);
    resultsHeadingRef.current?.focus();
  };

  const handleSaveToHistory = async () => {
    if (!livePreviewData || snapshotView) return;
    await saveReport({ reportType, subsidiary: subsidiaryLabel, dateStart, dateEnd, reportData: livePreviewData });
    setSavedSnapshot(true);
  };

  const handleOpenSnapshot = (report: ReportRecord) => {
    setSnapshotView(report);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    announce(`${t.a11y.snapshotLoadedPrefix}: ${report.reportType} - ${report.subsidiary}`);
    resultsHeadingRef.current?.focus();
  };

  const handleExitSnapshot = () => setSnapshotView(null);

  const handleRunAgain = (report: ReportRecord) => {
    setSnapshotView(null);
    if ((REPORT_TYPES as readonly string[]).includes(report.reportType)) {
      setReportType(report.reportType as ReportType);
    }
    // subsidiary is a display label (describeSelection), not the raw filter array — an
    // exact multi-select can't always be reconstructed from it, so a "N Subsidiary"
    // label is left as-is (all subsidiaries) rather than guessed at. Both English and
    // Indonesian forms are checked since report_history rows predate this page's copy.
    if (report.subsidiary === 'Semua Divisi' || report.subsidiary === 'All Divisions') {
      setFilterSubsidiary([]);
    } else if (!/^\d+ (Subsidiary|Subsidiaries)$/.test(report.subsidiary)) {
      setFilterSubsidiary(report.subsidiary.split(', ').filter(Boolean));
    }
    setDateStart(report.dateStart);
    setDateEnd(report.dateEnd);
    setToast({ message: t.toast.filtersLoaded, variant: 'success' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteReport = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteReport = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    const ok = await deleteReport(id);
    setToast(ok
      ? { message: t.toast.reportDeleted, variant: 'success' }
      : { message: t.toast.reportDeleteFailed, variant: 'error' });
    if (ok && snapshotView?.id === id) setSnapshotView(null);
  };

  const exportFileName = () => `${displayReportType.replace(/\s+/g, '_')}_${displayDateStart}_to_${displayDateEnd}`;

  const handleExportPDF = async () => {
    if (!previewData) return;
    const result = await exportReportPdf({
      previewData,
      subsidiary: displaySubsidiary,
      dateStart: displayDateStart,
      dateEnd: displayDateEnd,
      generatedBy: displayGeneratedBy,
      fileName: exportFileName(),
      chartElement: chartRef.current,
      onChartRenderStart: () => setExportingPdf(true),
      onChartRenderEnd: () => setExportingPdf(false),
    });
    if (result.ok) {
      logActivity({ actionType: 'EXPORT_REPORT', entityType: 'system', details: { reportType: displayReportType, subsidiary: displaySubsidiary, format: 'PDF' } });
      setToast({ message: t.toast.pdfSuccess, variant: 'success' });
    } else {
      setToast({ message: t.toast.exportFailure, variant: 'error' });
    }
  };

  const handleExportExcel = async () => {
    if (!previewData) return;
    const result = await exportReportXlsx({
      previewData,
      fileName: exportFileName(),
    });
    if (result.ok) {
      logActivity({ actionType: 'EXPORT_REPORT', entityType: 'system', details: { reportType: displayReportType, subsidiary: displaySubsidiary, format: 'Excel' } });
      setToast({ message: t.toast.excelSuccess, variant: 'success' });
    } else {
      setToast({ message: t.toast.exportFailure, variant: 'error' });
    }
  };

  const handleExportCsv = async () => {
    if (!previewData) return;
    const result = await exportReportCsv({
      previewData,
      fileName: exportFileName(),
    });
    if (result.ok) {
      logActivity({ actionType: 'EXPORT_REPORT', entityType: 'system', details: { reportType: displayReportType, subsidiary: displaySubsidiary, format: 'CSV' } });
      setToast({ message: t.toast.csvSuccess, variant: 'success' });
    } else {
      setToast({ message: t.toast.exportFailure, variant: 'error' });
    }
  };

  const exportActions = (
    <>
      <button
        type="button"
        onClick={handleExportPDF}
        disabled={!previewData || exportingPdf}
        aria-label={t.exportActions.pdfAria}
        className="flex items-center gap-1.5 border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary font-medium text-xs py-1.5 px-3 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="h-3.5 w-3.5" /> {exportingPdf ? t.exportActions.pdfRendering : t.exportActions.pdfLabel}
      </button>
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={!previewData}
        aria-label={t.exportActions.excelAria}
        className="flex items-center gap-1.5 border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary font-medium text-xs py-1.5 px-3 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Table2 className="h-3.5 w-3.5" /> {t.exportActions.excelLabel}
      </button>
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={!previewData}
        aria-label={t.exportActions.csvAria}
        className="flex items-center gap-1.5 border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary font-medium text-xs py-1.5 px-3 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FileText className="h-3.5 w-3.5" /> {t.exportActions.csvLabel}
      </button>
    </>
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      <div aria-live="polite" role="status" className="sr-only">{liveMessage}</div>

      <div>
        <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-1">{t.pageTitle}</h2>
        <p className="text-base text-on-surface-variant max-w-2xl">{t.pageDescription}</p>
      </div>

      <ReportFilterBar
        reportType={reportType}
        onReportTypeChange={setReportType}
        subsidiaries={subsidiaries}
        filterSubsidiary={filterSubsidiary}
        onFilterSubsidiaryChange={setFilterSubsidiary}
        categories={categories1}
        filterCategory={filterCategory}
        onFilterCategoryChange={setFilterCategory}
        locations={categories2}
        filterLocation={filterLocation}
        onFilterLocationChange={setFilterLocation}
        statuses={statusOptions}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        dateStart={dateStart}
        onDateStartChange={setDateStart}
        dateEnd={dateEnd}
        onDateEndChange={setDateEnd}
        dateError={dateError}
        chips={chips}
        onClearFilters={clearFilters}
        generating={generating}
        onReview={handleReview}
        canSave={!!livePreviewData && !snapshotView}
        saved={savedSnapshot}
        onSave={handleSaveToHistory}
      />

      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container/10 text-error px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div ref={resultsRef} className="flex flex-col gap-6">
        <h2 ref={resultsHeadingRef} tabIndex={-1} className="sr-only">{t.a11y.resultsHeading}</h2>

        {snapshotView && (
          <div className="rounded-lg border border-outline-variant bg-secondary-container/30 text-on-secondary-container px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 shrink-0" />
              {t.snapshot.bannerPrefix} {new Date(snapshotView.createdAt).toLocaleString()} {t.snapshot.bannerSuffix}
            </span>
            <button
              type="button"
              onClick={handleExitSnapshot}
              className="text-sm font-medium text-primary hover:underline shrink-0"
            >
              {t.snapshot.backToCurrent}
            </button>
          </div>
        )}

        {previewData && <ReportSummaryCards summary={previewData.summary} />}

        <ReportChart ref={chartRef} previewData={previewData} generatedAt={generatedAt} actions={exportActions} />

        {previewData && (
          <ReportDetailTable
            columns={previewData.detailColumns as DetailColumn<Record<string, unknown>>[]}
            data={previewData.detailData as unknown as Record<string, unknown>[]}
          />
        )}
      </div>

      <ReportHistoryTable
        reportHistory={reportHistory}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        activeId={snapshotView?.id ?? null}
        onPrev={() => setPage(Math.max(1, page - 1))}
        onNext={() => setPage(Math.min(totalPages, page + 1))}
        onOpen={handleOpenSnapshot}
        onRunAgain={handleRunAgain}
        onDelete={handleDeleteReport}
      />

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title={copy.confirm.deleteReportTitle}
        message={copy.confirm.deleteReportMessage}
        confirmLabel={copy.confirm.deleteLabel}
        cancelLabel={copy.confirm.cancelLabel}
        destructive
        onConfirm={confirmDeleteReport}
        onCancel={() => setPendingDeleteId(null)}
      />

      <Toast
        message={toast?.message ?? null}
        icon={toast?.variant === 'error' ? <AlertCircle className="h-4 w-4 text-error shrink-0" /> : undefined}
      />
    </div>
  );
}

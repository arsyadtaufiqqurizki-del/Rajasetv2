import { useRef, useState } from 'react';
import { useAsset } from '../contexts/AssetContext';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useReport } from '../contexts/ReportContext';
import type { ReportPreview, ReportType } from '../types/report';
import {
  buildValuationReport, buildDepreciationReport, buildMaintenanceCostReport,
  exportReportPdf, exportReportXlsx,
} from '../lib/reports';
import { logActivity } from '../lib/activityLogger';
import ReportConfigForm from '../components/reports/ReportConfigForm';
import ExportPanel from '../components/reports/ExportPanel';
import ReportChart from '../components/reports/ReportChart';
import ReportHistoryTable from '../components/reports/ReportHistoryTable';
import ConfirmModal from '../components/ui/ConfirmModal';
import { en as copy } from '../i18n/en';

export default function Reports() {
  const { assets, subsidiaries } = useAsset();
  const { records } = useMaintenance();
  const { reportHistory, page, totalPages, totalCount, setPage, saveReport, deleteReport } = useReport();
  const chartRef = useRef<HTMLDivElement>(null);

  const [reportType, setReportType] = useState<ReportType>('Asset Valuation Summary');
  const [subsidiary, setSubsidiary] = useState('All Divisions');
  const [dateStart, setDateStart] = useState('2023-01-01');
  const [dateEnd, setDateEnd] = useState('2023-12-31');

  const [previewData, setPreviewData] = useState<ReportPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const generatePreview = async () => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);

    const generated: ReportPreview =
      reportType === 'Asset Valuation Summary' ? buildValuationReport(assets, subsidiary, start, end) :
      reportType === 'Depreciation Schedule' ? buildDepreciationReport(assets, subsidiary, start, end) :
      buildMaintenanceCostReport(records, subsidiary, start, end);

    setPreviewData(generated);

    setGenerating(true);
    await saveReport({ reportType, subsidiary, dateStart, dateEnd, reportData: generated });
    setGenerating(false);
  };

  const handleDeleteReport = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteReport = () => {
    if (pendingDeleteId) deleteReport(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const exportFileName = () => `${reportType.replace(/\s+/g, '_')}_${dateStart}_to_${dateEnd}`;

  const handleExportPDF = async () => {
    if (!previewData || !previewData.data.length) return;
    await exportReportPdf({
      previewData,
      subsidiary,
      dateStart,
      dateEnd,
      generatedBy: reportHistory[0]?.userName ?? 'Unknown User',
      fileName: exportFileName(),
      chartElement: chartRef.current,
      onChartRenderStart: () => setExportingPdf(true),
      onChartRenderEnd: () => setExportingPdf(false),
    });
    logActivity({ actionType: 'EXPORT_REPORT', entityType: 'system', details: { reportType, subsidiary, format: 'PDF' } });
  };

  const handleExportExcel = async () => {
    if (!previewData || !previewData.data.length) return;
    await exportReportXlsx({
      previewData,
      sheetName: reportType,
      fileName: exportFileName(),
    });
    logActivity({ actionType: 'EXPORT_REPORT', entityType: 'system', details: { reportType, subsidiary, format: 'Excel' } });
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-1">Advanced Reporting & Analytics</h2>
        <p className="text-base text-on-surface-variant max-w-2xl">Configure, preview, and export high-fidelity data extracts regarding asset valuation, maintenance cycles, and compliance status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Side Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ReportConfigForm
            reportType={reportType}
            setReportType={setReportType}
            subsidiary={subsidiary}
            setSubsidiary={setSubsidiary}
            subsidiaries={subsidiaries}
            dateStart={dateStart}
            setDateStart={setDateStart}
            dateEnd={dateEnd}
            setDateEnd={setDateEnd}
            generating={generating}
            onGenerate={generatePreview}
          />
          <ExportPanel
            disabled={!previewData}
            exportingPdf={exportingPdf}
            onExportPdf={handleExportPDF}
            onExportExcel={handleExportExcel}
          />
        </div>

        {/* Right Side Results */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <ReportChart ref={chartRef} previewData={previewData} />
          <ReportHistoryTable
            reportHistory={reportHistory}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPrev={() => setPage(Math.max(1, page - 1))}
            onNext={() => setPage(Math.min(totalPages, page + 1))}
            onDelete={handleDeleteReport}
          />
        </div>
      </div>

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
    </div>
  );
}

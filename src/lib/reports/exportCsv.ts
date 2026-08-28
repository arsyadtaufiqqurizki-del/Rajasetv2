import type { ReportPreview } from '../../types/report';
import { sanitizeCell, toCsvBlob, downloadBlob } from '../csv';
import type { ExportResult } from './exportPdf';

export interface ExportCsvParams {
  previewData: ReportPreview;
  fileName: string;
}

// Detail rows only — the per-asset/record grain is what finance actually re-processes;
// the four headline numbers are better read in the summary cards or PDF/Excel.
export async function exportReportCsv(params: ExportCsvParams): Promise<ExportResult> {
  const { previewData, fileName } = params;
  const detailColumns = previewData.detailColumns as { key: string; label: string }[];
  const detailData = previewData.detailData as unknown as Record<string, unknown>[];
  if (!detailData.length) return { ok: false, reason: 'empty' };

  const rows = detailData.map(row =>
    Object.fromEntries(detailColumns.map(c => [c.label, sanitizeCell(row[c.key])]))
  );
  downloadBlob(`${fileName}.csv`, toCsvBlob(rows));
  return { ok: true };
}

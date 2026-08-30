import type { ReportPreview } from '../../types/report';
import { sanitizeCell } from '../csv';
import type { ExportResult } from './exportPdf';

export interface ExportXlsxParams {
  previewData: ReportPreview;
  fileName: string;
}

export async function exportReportXlsx(params: ExportXlsxParams): Promise<ExportResult> {
  const { previewData, fileName } = params;
  if (!previewData.data.length) return { ok: false, reason: 'empty' };

  const XLSX = await import('xlsx');

  const aggregateRows = (previewData.data as unknown as Record<string, unknown>[]).map(row =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sanitizeCell(value)]))
  );
  const summaryRows = (previewData.summary ?? []).map(item => ({ Metric: item.label, Value: item.value }));

  // Same sheet, two blocks: the four headline numbers first, then the chart's aggregate
  // table beneath — mirrors what exportPdf.ts puts on the PDF's first page.
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.sheet_add_json(summarySheet, aggregateRows, { origin: -1, skipHeader: false });

  const detailColumns = previewData.detailColumns as { key: string; label: string }[];
  const detailData = previewData.detailData as unknown as Record<string, unknown>[];
  const detailRows = detailData.map(row =>
    Object.fromEntries(detailColumns.map(c => [c.label, sanitizeCell(row[c.key])]))
  );
  const detailSheet = XLSX.utils.json_to_sheet(detailRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(wb, detailSheet, 'Detail');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
  return { ok: true };
}

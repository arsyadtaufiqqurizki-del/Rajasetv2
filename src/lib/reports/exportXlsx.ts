import type { ReportPreview } from '../../types/report';
import { sanitizeCell } from '../csv';

export interface ExportXlsxParams {
  previewData: ReportPreview;
  sheetName: string;
  fileName: string;
}

export async function exportReportXlsx(params: ExportXlsxParams): Promise<void> {
  const { previewData, sheetName, fileName } = params;
  if (!previewData.data.length) return;

  const XLSX = await import('xlsx');

  const rows = previewData.data as unknown as Record<string, unknown>[];
  const sanitizedData = rows.map(row =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sanitizeCell(value)]))
  );

  const ws = XLSX.utils.json_to_sheet(sanitizedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

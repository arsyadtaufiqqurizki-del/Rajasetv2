import type { MaintenanceRecord } from '../types/maintenance';

export type MaintenanceCsvField = {
  header: string;
  value: (record: MaintenanceRecord) => unknown;
};

export const MAINTENANCE_CSV_FIELDS: Record<string, MaintenanceCsvField> = {
  assetBook: { header: 'Asset Book', value: r => r.assetBook },
  subsidiary: { header: 'Subsidiary', value: r => r.subsidiary },
  assetNumber: { header: 'Asset Number', value: r => r.assetNumber },
  assetDescription: { header: 'Asset Description', value: r => r.assetDescription },
  assetUnits: { header: 'Asset Units', value: r => r.assetUnits },
  serviceType: { header: 'Service Type', value: r => r.serviceType },
  assetCategorySegment1: { header: 'Asset Category Segment 1', value: r => r.assetCategorySegment1 },
  assetCategorySegment2: { header: 'Asset Category Segment 2', value: r => r.assetCategorySegment2 },
  estimateCost: { header: 'Estimate Cost', value: r => r.estimateCost },
  actualCost: { header: 'Actual Cost', value: r => r.actualCost },
  status: { header: 'Status', value: r => r.status },
  scheduledDate: { header: 'Scheduled Date', value: r => r.scheduledDate },
};

export const MAINTENANCE_CSV_COLUMN_IDS = Object.keys(MAINTENANCE_CSV_FIELDS);

export function buildMaintenanceExportRows(
  records: MaintenanceRecord[],
  columnIds: string[],
  sanitize: (value: unknown) => unknown,
): Record<string, unknown>[] {
  return records.map(record => {
    const row: Record<string, unknown> = {};
    for (const columnId of columnIds) {
      const field = MAINTENANCE_CSV_FIELDS[columnId];
      if (!field) continue;
      row[field.header] = sanitize(field.value(record));
    }
    return row;
  });
}

import type { MaintenanceRecord } from '../../types/maintenance';
import type { MaintenanceCostReportPreview } from '../../types/report';
import { formatCurrency, parseCost } from '../money';
import { compactCurrencyAxisFormatter } from './shared';

export function buildMaintenanceCostReport(
  records: MaintenanceRecord[],
  start: Date,
  end: Date,
): MaintenanceCostReportPreview {
  const filteredRecords = records.filter(r => {
    if (!r.scheduledDate) return true;
    const d = new Date(r.scheduledDate);
    return d >= start && d <= end;
  });

  const grouped = filteredRecords.reduce<Record<string, { name: string; estimated: number; actual: number }>>((acc, record) => {
    const type = record.serviceType || 'General';
    const est = parseCost(record.estimateCost);
    const act = parseCost(record.actualCost);

    if (!acc[type]) acc[type] = { name: type, estimated: 0, actual: 0 };
    acc[type].estimated += est;
    acc[type].actual += act;
    return acc;
  }, {});

  const totals = Object.values(grouped).reduce(
    (acc, g) => {
      acc.estimated += g.estimated;
      acc.actual += g.actual;
      return acc;
    },
    { estimated: 0, actual: 0 },
  );

  return {
    type: 'composed',
    title: 'Estimated vs Actual Maintenance Costs',
    data: Object.values(grouped),
    yAxisFormatter: compactCurrencyAxisFormatter,
    summary: [
      { label: 'Total Estimated', value: formatCurrency(totals.estimated) },
      { label: 'Total Actual', value: formatCurrency(totals.actual) },
      { label: 'Variance', value: formatCurrency(totals.actual - totals.estimated) },
      { label: 'Records', value: filteredRecords.length.toLocaleString() },
    ],
    detailColumns: [
      { key: 'assetNumber', label: 'Asset Number' },
      { key: 'description', label: 'Description' },
      { key: 'serviceType', label: 'Service Type' },
      { key: 'scheduledDate', label: 'Scheduled Date' },
      { key: 'estimated', label: 'Estimated Cost', currency: true },
      { key: 'actual', label: 'Actual Cost', currency: true },
      { key: 'variance', label: 'Variance', currency: true },
    ],
    detailData: filteredRecords.map(r => {
      const estimated = parseCost(r.estimateCost);
      const actual = parseCost(r.actualCost);
      return {
        assetNumber: r.assetNumber,
        description: r.assetDescription,
        serviceType: r.serviceType || 'General',
        scheduledDate: r.scheduledDate || '-',
        estimated,
        actual,
        variance: actual - estimated,
      };
    }),
  };
}

import type { ReactNode } from 'react';
import { Edit, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDateDMY } from '../lib/dates';
import { TableEmptyRow } from './ui/EmptyState';
import { en as copy } from '../i18n/en';
import type { MaintenanceRecord } from '../types/maintenance';

export interface MaintenanceColumnDef {
  id: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string | ((record: MaintenanceRecord) => string);
  render: (record: MaintenanceRecord) => ReactNode;
}

function statusBadgeClass(status: string) {
  return cn(
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
    status === 'Completed' ? 'bg-primary-fixed text-on-primary-fixed border-transparent' :
    status === 'In Progress' ? 'bg-secondary-container text-on-secondary-container border-transparent' :
    status === 'Pending' ? 'bg-surface-variant text-on-surface-variant border-transparent' :
    'bg-error-container text-on-error-container border-error/20'
  );
}

function statusDotClass(status: string) {
  return cn(
    'w-1.5 h-1.5 rounded-full',
    status === 'Completed' ? 'bg-primary' :
    status === 'In Progress' ? 'bg-secondary' :
    status === 'Pending' ? 'bg-outline' : 'bg-error'
  );
}

export const MAINTENANCE_COLUMNS: MaintenanceColumnDef[] = [
  {
    id: 'assetNumber',
    label: 'Asset Number',
    cellClassName: (r) => cn('py-3 px-4 font-mono text-xs font-medium whitespace-nowrap', r.status === 'Overdue' ? 'text-error' : 'text-primary'),
    render: (r) => r.assetNumber,
  },
  {
    id: 'assetDescription',
    label: 'Asset Description',
    cellClassName: 'py-3 px-4 text-on-surface whitespace-nowrap max-w-64 truncate',
    render: (r) => <span title={r.assetDescription}>{r.assetDescription}</span>,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiaries',
    cellClassName: 'py-3 px-4 text-on-surface whitespace-nowrap',
    render: (r) => r.subsidiary,
  },
  {
    id: 'serviceType',
    label: 'Service Type',
    cellClassName: 'py-3 px-4 text-on-surface whitespace-nowrap',
    render: (r) => r.serviceType,
  },
  {
    id: 'scheduledDate',
    label: 'Scheduled Date',
    cellClassName: 'py-3 px-4 text-on-surface font-mono text-xs whitespace-nowrap',
    render: (r) => formatDateDMY(r.scheduledDate),
  },
  {
    id: 'estimateCost',
    label: 'Estimate Cost',
    headerClassName: 'text-right',
    cellClassName: 'py-3 px-4 font-mono text-xs text-right whitespace-nowrap',
    render: (r) => r.estimateCost,
  },
  {
    id: 'actualCost',
    label: 'Actual Cost',
    headerClassName: 'text-right',
    cellClassName: 'py-3 px-4 font-mono text-xs text-right whitespace-nowrap',
    render: (r) => r.actualCost,
  },
  {
    id: 'status',
    label: 'Status',
    cellClassName: 'py-3 px-4 whitespace-nowrap',
    render: (r) => (
      <span className={statusBadgeClass(r.status)}>
        <span className={statusDotClass(r.status)} />
        {r.status}
      </span>
    ),
  },
  {
    id: 'assetBook',
    label: 'Asset Book',
    cellClassName: 'py-3 px-4 text-on-surface whitespace-nowrap',
    render: (r) => r.assetBook,
  },
  {
    id: 'assetUnits',
    label: 'Asset Units',
    cellClassName: 'py-3 px-4 text-on-surface whitespace-nowrap',
    render: (r) => r.assetUnits,
  },
  {
    id: 'assetCategorySegment1',
    label: 'Asset Class',
    cellClassName: 'py-3 px-4 text-on-surface whitespace-nowrap',
    render: (r) => r.assetCategorySegment1,
  },
  {
    id: 'assetCategorySegment2',
    label: 'Location',
    cellClassName: 'py-3 px-4 text-on-surface whitespace-nowrap',
    render: (r) => r.assetCategorySegment2,
  },
];

export const DEFAULT_VISIBLE_COLUMNS = [
  'assetNumber',
  'assetDescription',
  'subsidiary',
  'serviceType',
  'scheduledDate',
  'estimateCost',
  'actualCost',
  'status',
];

const TH_BASE = 'py-3 px-4 text-xs font-semibold text-on-surface-variant whitespace-nowrap text-left';

interface MaintenanceTableProps {
  records: MaintenanceRecord[];
  visibleColumns: Set<string>;
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  onToggleSort: (key: string) => void;
  sortableColumns: Record<string, (r: MaintenanceRecord) => string | number>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onAddNew: () => void;
}

export default function MaintenanceTable({
  records,
  visibleColumns,
  sortKey,
  sortDirection,
  onToggleSort,
  sortableColumns,
  onEdit,
  onDelete,
  hasActiveFilters,
  onClearFilters,
  onAddNew,
}: MaintenanceTableProps) {
  const columns = MAINTENANCE_COLUMNS.filter(col => visibleColumns.has(col.id));
  const colSpan = columns.length + 1;

  const renderHeaderLabel = (col: MaintenanceColumnDef) => {
    if (!sortableColumns[col.id]) return col.label;
    const active = sortKey === col.id;
    return (
      <button
        type="button"
        onClick={() => onToggleSort(col.id)}
        className="inline-flex items-center gap-1 hover:text-on-surface transition-colors"
      >
        <span>{col.label}</span>
        {active ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    );
  };

  return (
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left border-collapse">
        <caption className="sr-only">Maintenance records · {records.length.toLocaleString()} shown</caption>
        <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-20">
          <tr>
            <th scope="col" className={TH_BASE}>Action</th>
            {columns.map(col => (
              <th key={col.id} scope="col" className={cn(TH_BASE, col.headerClassName)}>
                {renderHeaderLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-outline-variant/30">
          {records.length > 0 ? records.map((record) => (
            <tr key={record.id} className={cn('hover:bg-surface-container-lowest transition-colors', record.status === 'Overdue' ? 'bg-error-container/5' : '')}>
              <td className="py-3 px-4 text-left whitespace-nowrap">
                <div className="flex items-center justify-start gap-2">
                  <button
                    onClick={() => onEdit(record.id)}
                    className="p-1 hover:bg-surface-container-low text-primary rounded transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(record.id)}
                    className="p-1 hover:bg-error-container/50 text-error rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
              {columns.map(col => (
                <td key={col.id} className={typeof col.cellClassName === 'function' ? col.cellClassName(record) : col.cellClassName}>
                  {col.render(record)}
                </td>
              ))}
            </tr>
          )) : (
            <TableEmptyRow
              colSpan={colSpan}
              message={hasActiveFilters ? copy.emptyState.noMaintenanceFiltered : copy.emptyState.noMaintenanceData}
              action={
                hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface hover:border-primary hover:text-primary transition-colors"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onAddNew}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:opacity-90 transition-opacity"
                  >
                    + Add Maintenance Record
                  </button>
                )
              }
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

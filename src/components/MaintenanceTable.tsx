import { Edit, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { TableEmptyRow } from './ui/EmptyState';
import { id as copy } from '../i18n/id';
import type { MaintenanceRecord } from '../types/maintenance';

interface MaintenanceTableProps {
  records: MaintenanceRecord[];
  hasAnyRecords: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function MaintenanceTable({ records, hasAnyRecords, onEdit, onDelete }: MaintenanceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-container-low border-b border-outline-variant whitespace-nowrap">
          <tr>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant text-left">Action</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Book</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Subsidiaries</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Number</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Description</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Units</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Service Type</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Asset Class</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Location</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Estimate Cost</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Actual Cost</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant">Status</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-outline-variant/30">
          {records.length > 0 ? records.map((act) => (
            <tr key={act.id} className={cn('hover:bg-surface-container-lowest transition-colors whitespace-nowrap', act.status === 'Overdue' ? 'bg-error-container/5' : '')}>
              <td className="py-3 px-4 text-left">
                <div className="flex items-center justify-start gap-2">
                  <button
                    onClick={() => onEdit(act.id)}
                    className="p-1 hover:bg-surface-container-low text-primary rounded transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(act.id)}
                    className="p-1 hover:bg-error-container/50 text-error rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
              <td className="py-3 px-4">{act.assetBook}</td>
              <td className="py-3 px-4">{act.subsidiary}</td>
              <td className={cn('py-3 px-4 font-mono text-xs font-medium', act.status === 'Overdue' ? 'text-error' : 'text-primary')}>{act.assetNumber}</td>
              <td className="py-3 px-4">{act.assetDescription}</td>
              <td className="py-3 px-4">{act.assetUnits}</td>
              <td className="py-3 px-4">{act.serviceType}</td>
              <td className="py-3 px-4">{act.assetCategorySegment1}</td>
              <td className="py-3 px-4">{act.assetCategorySegment2}</td>
              <td className="py-3 px-4 font-mono text-xs">{act.estimateCost}</td>
              <td className="py-3 px-4 font-mono text-xs">{act.actualCost}</td>
              <td className="py-3 px-4">
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                  act.status === 'Completed' ? 'bg-primary-fixed text-on-primary-fixed border-transparent' :
                  act.status === 'In Progress' ? 'bg-secondary-container text-on-secondary-container border-transparent' :
                  act.status === 'Pending' ? 'bg-surface-variant text-on-surface-variant border-transparent' :
                  'bg-error-container text-on-error-container border-error/20'
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                     act.status === 'Completed' ? 'bg-primary' :
                     act.status === 'In Progress' ? 'bg-secondary' :
                     act.status === 'Pending' ? 'bg-outline' : 'bg-error'
                  )} />
                  {act.status}
                </span>
              </td>
            </tr>
          )) : (
            <TableEmptyRow
              colSpan={12}
              message={hasAnyRecords ? copy.emptyState.noMaintenanceFiltered : copy.emptyState.noMaintenanceData}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

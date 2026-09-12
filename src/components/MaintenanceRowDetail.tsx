import { motion } from 'motion/react';
import { Pencil } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatCurrency, parseCost } from '../lib/money';
import { formatDateDMY } from '../lib/dates';
import type { MaintenanceRecord } from '../types/maintenance';

interface MaintenanceRowDetailProps {
  record: MaintenanceRecord;
  history: MaintenanceRecord[];
  onEditRecord: (id: string) => void;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className={cn('text-sm text-on-surface', mono && 'font-mono text-xs')}>{value || '—'}</span>
    </div>
  );
}

export default function MaintenanceRowDetail({ record, history, onEditRecord }: MaintenanceRowDetailProps) {
  const estimate = parseCost(record.estimateCost);
  const actual = parseCost(record.actualCost);
  const hasCosts = record.estimateCost !== '' || record.actualCost !== '';
  const variance = actual - estimate;
  const varianceOver = hasCosts && variance > 0;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 py-4 bg-surface-container-low/50 border-t border-outline-variant/30">
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Asset Information</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset Book" value={record.assetBook} />
            <Field label="Subsidiary" value={record.subsidiary} />
            <Field label="Asset Class" value={record.assetCategorySegment1} />
            <Field label="Location" value={record.assetCategorySegment2} />
            <Field label="Units" value={record.assetUnits} />
            <Field label="Scheduled" value={formatDateDMY(record.scheduledDate)} mono />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Cost Breakdown</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estimate" value={record.estimateCost ? formatCurrency(estimate) : '—'} mono />
            <Field label="Actual" value={record.actualCost ? formatCurrency(actual) : '—'} mono />
            <div className="flex flex-col gap-0.5 col-span-2">
              <span className="text-xs text-on-surface-variant">Variance</span>
              <span className={cn('text-sm font-mono font-semibold', !hasCosts ? 'text-on-surface' : varianceOver ? 'text-error' : 'text-emerald-600')}>
                {!hasCosts ? '—' : `${varianceOver ? '+' : ''}${formatCurrency(variance)}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Service History {history.length > 0 && `(${history.length})`}
          </h4>
          {history.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No other maintenance records for this asset.</p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {history.map(h => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onEditRecord(h.id);
                    }}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-left text-xs hover:border-primary transition-colors"
                  >
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-on-surface truncate">{h.serviceType || '—'}</span>
                      <span className="font-mono text-on-surface-variant">{formatDateDMY(h.scheduledDate)}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-on-surface-variant">{h.status}</span>
                      <Pencil className="h-3 w-3 text-primary" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
}

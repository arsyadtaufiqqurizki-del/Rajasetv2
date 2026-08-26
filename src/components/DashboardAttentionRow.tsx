import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AssetStatusOption } from '../hooks/useDashboardMetrics';

interface DashboardAttentionRowProps {
  statusCounts: Record<AssetStatusOption, number>;
  filterStatus: string[];
  onToggleStatus: (status: AssetStatusOption) => void;
}

const ATTENTION_STATUSES: AssetStatusOption[] = ['Broken', 'Needs Service', 'In Maintenance'];

export default function DashboardAttentionRow({ statusCounts, filterStatus, onToggleStatus }: DashboardAttentionRowProps) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface shrink-0">
        <AlertTriangle className="h-4 w-4 text-error" aria-hidden="true" />
        Needs Attention
      </span>
      <div className="flex flex-wrap gap-2">
        {ATTENTION_STATUSES.map((status) => {
          const count = statusCounts[status];
          const isActive = filterStatus.includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggleStatus(status)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive
                  ? 'border-error bg-error text-on-error'
                  : count > 0
                    ? 'border-error/30 bg-error-container/10 text-error hover:bg-error-container/20'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
              )}
            >
              {status}
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

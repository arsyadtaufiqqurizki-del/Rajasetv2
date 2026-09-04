import { ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AssetListedOption } from '../hooks/useDashboardMetrics';

interface DashboardListedRowProps {
  listedCounts: Record<AssetListedOption, number>;
  filterListed: string[];
  onToggleListed: (listed: AssetListedOption) => void;
}

export default function DashboardListedRow({ listedCounts, filterListed, onToggleListed }: DashboardListedRowProps) {
  const total = listedCounts['Audited'] + listedCounts['Non-Listed'];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface shrink-0">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        Listed Status
      </span>
      <div className="flex flex-wrap gap-2">
        {(['Audited', 'Non-Listed'] as const).map((option) => {
          const count = listedCounts[option];
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          const isActive = filterListed.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggleListed(option)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container'
              )}
            >
              {option}
              <span className="tabular-nums opacity-80">{count} ({percent}%)</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

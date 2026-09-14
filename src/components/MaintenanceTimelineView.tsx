import { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/money';
import { formatDateDMY } from '../lib/dates';
import type { MaintenanceRecord } from '../types/maintenance';
import { useTimelineRange, type TimelineGroupMode } from '../hooks/useTimelineRange';

interface MaintenanceTimelineViewProps {
  records: MaintenanceRecord[];
  onSelectRecord: (id: string) => void;
}

function barClass(status: string) {
  return cn(
    'block w-full truncate rounded-md px-2 py-1 text-left text-[11px] font-medium border transition-colors hover:brightness-95 hover:ring-1 hover:ring-primary',
    status === 'Completed' && 'bg-primary-fixed text-on-primary-fixed border-transparent',
    status === 'In Progress' && 'bg-secondary-container text-on-secondary-container border-transparent',
    status === 'Pending' && 'bg-surface-variant text-on-surface-variant border-transparent',
    !(status === 'Completed' || status === 'In Progress' || status === 'Pending') && 'bg-error-container text-on-error-container border-error/20',
  );
}

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const GROUP_OPTIONS: Array<{ id: TimelineGroupMode; label: string }> = [
  { id: 'asset', label: 'By Asset' },
  { id: 'service', label: 'By Service' },
  { id: 'flat', label: 'Flat' },
];

export default function MaintenanceTimelineView({ records, onSelectRecord }: MaintenanceTimelineViewProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [groupBy, setGroupBy] = useState<TimelineGroupMode>('asset');
  const { weekStart, weekEnd, days, inRange, groups } = useTimelineRange(records, viewDate, groupBy);

  const goWeek = (offset: number) => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset * 7);
      return d;
    });
  };

  const goThisWeek = () => setViewDate(new Date());

  const weekLabel = `${formatDateDMY(weekStart.toISOString())} – ${formatDateDMY(weekEnd.toISOString())}`;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goWeek(-1)}
            aria-label="Previous week"
            className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-sm font-semibold text-on-surface min-w-52 text-center">{weekLabel}</h3>
          <button
            type="button"
            onClick={() => goWeek(1)}
            aria-label="Next week"
            className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goThisWeek}
            className="ml-1 text-sm font-medium text-primary hover:underline"
          >
            This Week
          </button>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Timeline grouping">
          {GROUP_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setGroupBy(opt.id)}
              aria-pressed={groupBy === opt.id}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                groupBy === opt.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:text-on-surface',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {inRange.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BarChart3 className="h-10 w-10 text-on-surface-variant/50" aria-hidden="true" />
          <p className="text-lg font-semibold text-on-surface">No maintenance scheduled in this period.</p>
          <p className="text-sm text-on-surface-variant">Use the week navigation above to browse other weeks.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-outline-variant/50">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[220px_repeat(7,1fr)] gap-px bg-outline-variant/30 border-b border-outline-variant/50">
              <div className="bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface-variant uppercase">
                {groups.length} group{groups.length === 1 ? '' : 's'} · {inRange.length} record{inRange.length === 1 ? '' : 's'}
              </div>
              {days.map(day => (
                <div key={day.toISOString()} className="bg-surface-container-low px-2 py-2 text-center">
                  <div className="text-[11px] font-semibold text-on-surface-variant uppercase">
                    {day.toLocaleDateString('default', { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-semibold text-on-surface">{day.getDate()}</div>
                </div>
              ))}
            </div>
            {groups.map(group => (
              <div key={group.key} className="grid grid-cols-[220px_repeat(7,1fr)] gap-px bg-outline-variant/30 border-b border-outline-variant/30 last:border-b-0">
                <div className="bg-surface-container-lowest px-3 py-2 min-w-0">
                  <div className="truncate text-sm font-semibold text-on-surface" title={group.label}>
                    {group.label}
                  </div>
                  <div className="truncate text-xs text-on-surface-variant" title={group.sublabel}>
                    {group.sublabel} · {group.records.length}
                  </div>
                </div>
                {days.map(day => {
                  const key = toDayKey(day);
                  const cellRecords = group.records.filter(r => {
                    if (!r.scheduledDate) return false;
                    const d = new Date(r.scheduledDate);
                    if (isNaN(d.getTime())) return false;
                    return toDayKey(d) === key;
                  });
                  return (
                    <div key={key} className="bg-surface-container-lowest px-1.5 py-1.5 flex flex-col gap-1 min-h-[44px]">
                      {cellRecords.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onSelectRecord(r.id)}
                          title={`${r.assetDescription} · ${r.serviceType} · ${r.status} · ${formatDateDMY(r.scheduledDate)} · ${formatCurrency(r.actualCost || r.estimateCost)}`}
                          className={barClass(r.status)}
                        >
                          {r.serviceType || r.assetNumber}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { Settings as SettingsIcon, AlertTriangle, CircleDollarSign, CalendarDays } from 'lucide-react';
import { LineChart, Line } from 'recharts';
import StatCard from './ui/StatCard';
import { parseCost } from '../lib/money';
import { en as copy } from '../i18n/en';
import type { MaintenanceRecord } from '../types/maintenance';

interface MaintenanceStatsProps {
  activeCount: number;
  overdueCount: number;
  formattedCost: number | string;
  totalCost: number;
  upcomingCount: number;
  records: MaintenanceRecord[];
}

interface MonthBucket {
  label: string;
  total: number;
}

function lastSixMonths(): { key: string; label: string }[] {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: d.toLocaleString('default', { month: 'short' }) });
  }
  return months;
}

export default function MaintenanceStats({ activeCount, overdueCount, formattedCost, totalCost, upcomingCount, records }: MaintenanceStatsProps) {
  const trend: MonthBucket[] = useMemo(() => {
    const months = lastSixMonths();
    const totals = new Map<string, number>(months.map(m => [m.key, 0]));
    for (const r of records) {
      if (!r.scheduledDate) continue;
      const d = new Date(r.scheduledDate);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!totals.has(key)) continue;
      totals.set(key, (totals.get(key) ?? 0) + parseCost(r.actualCost || r.estimateCost));
    }
    return months.map(m => ({ label: m.label, total: totals.get(m.key) ?? 0 }));
  }, [records]);

  const nonZeroPoints = trend.filter(t => t.total > 0).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Assets Under Maint."
        value={activeCount}
        icon={<SettingsIcon className="h-5 w-5" />}
        footer={activeCount === 0 ? copy.emptyState.noDataFooter : 'Active service tickets'}
      />
      <StatCard
        label="Overdue Maintenance"
        value={overdueCount}
        icon={<AlertTriangle className="h-5 w-5 fill-current text-error" />}
        tone="danger"
        valueClassName={overdueCount > 0 ? 'text-error' : 'text-on-surface'}
        footer={overdueCount === 0 ? copy.emptyState.noDataFooter : 'Requires attention'}
      />
      <StatCard
        label="Total Cost (YTD)"
        value={formattedCost}
        icon={<CircleDollarSign className="h-5 w-5" />}
        footer={totalCost === 0 ? copy.emptyState.noDataFooter : 'Estimated & Actual · last 6 months'}
        chart={nonZeroPoints >= 2 ? (
          <div className="mt-1" aria-hidden="true">
            <LineChart width={180} height={48} data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <Line type="monotone" dataKey="total" stroke="var(--color-secondary)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </div>
        ) : undefined}
      />
      <StatCard
        label="Upcoming This Week"
        value={upcomingCount}
        icon={<CalendarDays className="h-5 w-5" />}
        footer={upcomingCount === 0 ? copy.emptyState.noDataFooter : 'Scheduled maintenance'}
      />
    </div>
  );
}

import { Settings as SettingsIcon, AlertTriangle, CircleDollarSign, CalendarDays } from 'lucide-react';
import StatCard from './ui/StatCard';

interface MaintenanceStatsProps {
  activeCount: number;
  overdueCount: number;
  formattedCost: number | string;
  totalCost: number;
  upcomingCount: number;
}

export default function MaintenanceStats({ activeCount, overdueCount, formattedCost, totalCost, upcomingCount }: MaintenanceStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Assets Under Maint."
        value={activeCount}
        icon={<SettingsIcon className="h-5 w-5" />}
        footer={activeCount === 0 ? 'Belum ada data' : 'Active service tickets'}
      />
      <StatCard
        label="Overdue Maintenance"
        value={overdueCount}
        icon={<AlertTriangle className="h-5 w-5 fill-current text-error" />}
        tone="danger"
        valueClassName={overdueCount > 0 ? 'text-error' : 'text-on-surface'}
        footer={overdueCount === 0 ? 'Belum ada data' : 'Requires attention'}
      />
      <StatCard
        label="Total Cost (YTD)"
        value={formattedCost}
        icon={<CircleDollarSign className="h-5 w-5" />}
        footer={totalCost === 0 ? 'Belum ada data' : 'Estimated & Actual'}
      />
      <StatCard
        label="Upcoming This Week"
        value={upcomingCount}
        icon={<CalendarDays className="h-5 w-5" />}
        footer={upcomingCount === 0 ? 'Belum ada data' : 'Scheduled maintenance'}
      />
    </div>
  );
}

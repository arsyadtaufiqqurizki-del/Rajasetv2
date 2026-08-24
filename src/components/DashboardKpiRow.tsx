import { Package, TrendingUp, TrendingDown, AlertTriangle, FileUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { en as copy } from '../i18n/en';
import StatCard from './ui/StatCard';
import { ASSET_STATUS_OPTIONS, type AssetStatusOption } from '../hooks/useDashboardMetrics';

interface DashboardKpiRowProps {
  assetsCount: number;
  assetCountChange: number;
  formattedValuation: string;
  fullValuation: string;
  assetCostChange: number;
  statusCounts: Record<AssetStatusOption, number>;
  selectedStatus: AssetStatusOption;
  onSelectedStatusChange: (status: AssetStatusOption) => void;
}

const URGENT_STATUSES: AssetStatusOption[] = ['Needs Service', 'Broken'];

function ChangeFooter({ change }: { change: number }) {
  if (change === 0) {
    return <span className="text-on-surface-variant font-medium">{copy.emptyState.noChangeFromLastMonth}</span>;
  }
  return (
    <>
      <span className={cn('flex items-center font-medium', change > 0 ? 'text-emerald-600' : 'text-red-600')}>
        {change > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {Math.abs(change).toFixed(1)}%
      </span>
      <span className="text-on-surface-variant">vs last month</span>
    </>
  );
}

export default function DashboardKpiRow({
  assetsCount,
  assetCountChange,
  formattedValuation,
  fullValuation,
  assetCostChange,
  statusCounts,
  selectedStatus,
  onSelectedStatusChange,
}: DashboardKpiRowProps) {
  const selectedStatusCount = statusCounts[selectedStatus];
  const selectedStatusPercentage = assetsCount > 0 ? (selectedStatusCount / assetsCount) * 100 : 0;
  const isUrgent = URGENT_STATUSES.includes(selectedStatus);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        label="Asset Units"
        icon={<Package className="h-5 w-5 text-primary" />}
        value={assetsCount}
        footer={<ChangeFooter change={assetCountChange} />}
      />

      <StatCard
        label="Asset Cost"
        icon={<FileUp className="h-5 w-5 text-primary" />}
        value={
          <div className="relative group w-fit cursor-default">
            {formattedValuation}
            <div
              className="pointer-events-none absolute left-0 bottom-full mb-1 whitespace-nowrap rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium text-[#45464d] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
              style={{ borderColor: '#c6c6cd' }}
            >
              {fullValuation}
            </div>
          </div>
        }
        footer={<ChangeFooter change={assetCostChange} />}
      />

      <StatCard
        label={
          <select
            value={selectedStatus}
            onChange={(e) => onSelectedStatusChange(e.target.value as AssetStatusOption)}
            className="bg-transparent text-on-surface-variant font-medium text-xs tracking-wider uppercase focus:outline-none cursor-pointer"
          >
            {ASSET_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        }
        icon={<AlertTriangle className={cn('h-5 w-5', isUrgent ? 'text-error' : 'text-primary')} />}
        value={selectedStatusCount}
        tone={isUrgent ? 'danger' : 'default'}
        footer={
          <>
            <span className={cn('font-medium', isUrgent && selectedStatusPercentage > 10 ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-on-surface-variant')}>
              {selectedStatusPercentage.toFixed(1)}%
            </span>
            <span className="text-on-surface-variant">of total assets</span>
          </>
        }
      />
    </div>
  );
}

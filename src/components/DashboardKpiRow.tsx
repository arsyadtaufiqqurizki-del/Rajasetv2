import { Package, TrendingUp, TrendingDown, FileUp, Wallet, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { en as copy } from '../i18n/en';
import StatCard from './ui/StatCard';
import ValueWithTooltip from './ui/ValueWithTooltip';

const KPI_VALUE_CLASS = 'text-3xl font-semibold text-primary';

interface DashboardKpiRowProps {
  assetsCount: number;
  assetCountChange: number | null;
  formattedValuation: string;
  fullValuation: string;
  assetCostChange: number | null;
  formattedBookValue: string;
  fullBookValue: string;
  bookValueRatio: number;
  formattedDepreciation: string;
  fullDepreciation: string;
  depreciationRatio: number;
}

function ChangeFooter({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-neutral font-medium">{copy.emptyState.noPriorMonthData}</span>;
  }
  if (change === 0) {
    return <span className="text-neutral font-medium">{copy.emptyState.noChangeFromLastMonth}</span>;
  }
  return (
    <>
      <span className={cn('flex items-center font-medium', change > 0 ? 'text-positive' : 'text-negative')}>
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
  formattedBookValue,
  fullBookValue,
  bookValueRatio,
  formattedDepreciation,
  fullDepreciation,
  depreciationRatio,
}: DashboardKpiRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <StatCard
        label="Asset Units"
        icon={<Package className="h-5 w-5 text-primary" />}
        value={assetsCount}
        valueClassName={KPI_VALUE_CLASS}
        footer={<ChangeFooter change={assetCountChange} />}
      />

      <StatCard
        label="Asset Cost"
        icon={<FileUp className="h-5 w-5 text-primary" />}
        value={<ValueWithTooltip value={formattedValuation} full={fullValuation} />}
        valueClassName={KPI_VALUE_CLASS}
        footer={<ChangeFooter change={assetCostChange} />}
      />

      <StatCard
        label="Net Book Value"
        icon={<Wallet className="h-5 w-5 text-primary" />}
        value={<ValueWithTooltip value={formattedBookValue} full={fullBookValue} />}
        valueClassName={KPI_VALUE_CLASS}
        footer={<span className="text-on-surface-variant font-medium">{bookValueRatio.toFixed(1)}% of asset cost</span>}
      />

      <StatCard
        label="Accumulated Depreciation"
        icon={<Layers className="h-5 w-5 text-primary" />}
        value={<ValueWithTooltip value={formattedDepreciation} full={fullDepreciation} />}
        valueClassName={KPI_VALUE_CLASS}
        footer={<span className="text-on-surface-variant font-medium">{depreciationRatio.toFixed(1)}% depreciated</span>}
      />
    </div>
  );
}

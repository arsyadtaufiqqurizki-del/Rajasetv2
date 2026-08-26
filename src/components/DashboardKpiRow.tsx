import { useId } from 'react';
import { Package, TrendingUp, TrendingDown, FileUp, Wallet, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { en as copy } from '../i18n/en';
import StatCard from './ui/StatCard';

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

/** Shows the compact value with the full precision figure available on hover or keyboard focus. */
function ValueWithTooltip({ value, full }: { value: string; full: string }) {
  const tooltipId = useId();
  return (
    <div className="relative group w-fit">
      <button
        type="button"
        aria-describedby={tooltipId}
        className="cursor-help bg-transparent border-0 p-0 m-0 text-inherit [font:inherit] underline decoration-dotted decoration-on-surface-variant/50 underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {value}
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-0 bottom-full mb-1 whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs font-medium text-on-surface-variant opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {full}
      </div>
    </div>
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

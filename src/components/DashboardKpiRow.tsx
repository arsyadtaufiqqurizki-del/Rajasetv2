import { useState } from 'react';
import { Package, TrendingUp, TrendingDown, FileUp, Wallet, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { en as copy } from '../i18n/en';
import StatCard from './ui/StatCard';
import ValueWithTooltip from './ui/ValueWithTooltip';

const KPI_VALUE_CLASS = 'text-3xl font-semibold text-primary';

type AssetCountMode = 'rows' | 'units';

interface DashboardKpiRowProps {
  assetsCount: number;
  assetCountChange: number | null;
  totalUnits: number;
  assetUnitsChange: number | null;
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
  totalUnits,
  assetUnitsChange,
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
  const [countMode, setCountMode] = useState<AssetCountMode>('rows');
  const isUnits = countMode === 'units';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      <StatCard
        label={
          <span className="flex items-center gap-2">
            <span>Asset Type</span>
            <select
              value={countMode}
              onChange={(e) => setCountMode(e.target.value as AssetCountMode)}
              aria-label="Asset count mode"
              className="normal-case tracking-normal text-[11px] font-medium bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="rows">Rows</option>
              <option value="units">Units</option>
            </select>
          </span>
        }
        icon={<Package className="h-5 w-5 text-primary" />}
        value={(isUnits ? totalUnits : assetsCount).toLocaleString('en-US')}
        valueClassName={KPI_VALUE_CLASS}
        footer={<ChangeFooter change={isUnits ? assetUnitsChange : assetCountChange} />}
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

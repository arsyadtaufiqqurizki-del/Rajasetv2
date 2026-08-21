import { Package, TrendingUp, TrendingDown, AlertTriangle, FileUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { en as copy } from '../i18n/en';
import StatCard from './ui/StatCard';

interface DashboardKpiRowProps {
  assetsCount: number;
  assetCountChange: number;
  formattedValuation: string;
  fullValuation: string;
  assetCostChange: number;
  brokenAssetsCount: number;
  brokenAssetPercentage: number;
}

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
  brokenAssetsCount,
  brokenAssetPercentage,
}: DashboardKpiRowProps) {
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
        label="Broken Asset"
        icon={<AlertTriangle className="h-5 w-5 text-error" />}
        value={brokenAssetsCount}
        tone="danger"
        footer={
          <>
            <span className={cn('font-medium', brokenAssetPercentage > 10 ? 'text-red-600' : 'text-amber-600')}>
              {brokenAssetPercentage.toFixed(1)}%
            </span>
            <span className="text-on-surface-variant">of total assets</span>
          </>
        }
      />
    </div>
  );
}

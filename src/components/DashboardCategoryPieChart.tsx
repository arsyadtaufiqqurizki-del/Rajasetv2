import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrencyWhole } from '../lib/money';
import type { DashboardCategoryPoint } from '../hooks/useDashboardMetrics';
import AllCategoriesModal from './AllCategoriesModal';

const LEGEND_LIMIT = 6;

interface DashboardCategoryPieChartProps {
  data: DashboardCategoryPoint[];
  /** Formatted total valuation — same unit as the segments, unlike a raw asset count. */
  totalValueFormatted: string;
}

export default function DashboardCategoryPieChart({ data, totalValueFormatted }: DashboardCategoryPieChartProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const visibleLegend = data.slice(0, LEGEND_LIMIT);
  const remainingCount = Math.max(0, data.length - LEGEND_LIMIT);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-on-surface">Asset Categories</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-sm font-medium text-primary hover:underline"
        >
          View All
        </button>
      </div>
      <div className="flex-1 min-h-[200px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatCurrencyWhole(Number(value)), 'Valuation']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-2">
          <span className="text-2xl font-bold text-primary">{totalValueFormatted}</span>
          <span className="text-xs text-on-surface-variant">Total Value</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {visibleLegend.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </div>
        ))}
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            +{remainingCount} more
          </button>
        )}
      </div>
      <AllCategoriesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={data} />
    </div>
  );
}

import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrencyWhole } from '../lib/money';
import type { DashboardCategoryPoint } from '../hooks/useDashboardMetrics';
import AllCategoriesModal from './AllCategoriesModal';

interface DashboardCategoryPieChartProps {
  data: DashboardCategoryPoint[];
  totalAssets: number;
}

export default function DashboardCategoryPieChart({ data, totalAssets }: DashboardCategoryPieChartProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">Asset Categories</h3>
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
          <span className="text-2xl font-bold text-primary">{totalAssets}</span>
          <span className="text-xs text-on-surface-variant">Asset Class</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </div>
        ))}
      </div>
      <AllCategoriesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={data} />
    </div>
  );
}

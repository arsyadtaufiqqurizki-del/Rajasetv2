import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts';
import { formatCompactCurrency, formatCurrencyWhole } from '../lib/money';
import type { DashboardSubsidiaryComparisonPoint } from '../hooks/useDashboardMetrics';
import AllSubsidiariesModal from './AllSubsidiariesModal';

interface DashboardSubsidiaryBarChartProps {
  data: DashboardSubsidiaryComparisonPoint[];
  allData: DashboardSubsidiaryComparisonPoint[];
}

type RenderableValue = string | number | boolean | null | undefined;

const formatLabel = (value: RenderableValue) => formatCompactCurrency(Number(value ?? 0));

export default function DashboardSubsidiaryBarChart({ data, allData }: DashboardSubsidiaryBarChartProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-on-surface">Top 5 Subsidiaries by Valuation</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-sm font-medium text-primary hover:underline"
        >
          View All
        </button>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 40, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-chart-axis)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-outline-variant)' }}
              formatter={(value, name) => [formatCurrencyWhole(Number(value)), name]}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="assetCost" name="Asset Cost" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} barSize={16}>
              <LabelList dataKey="assetCost" position="right" formatter={formatLabel} fill="var(--color-on-surface)" fontSize={11} fontWeight={500} />
            </Bar>
            <Bar dataKey="bookValue" name="Book Value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} barSize={16}>
              <LabelList dataKey="bookValue" position="right" formatter={formatLabel} fill="var(--color-on-surface)" fontSize={11} fontWeight={500} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <AllSubsidiariesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={allData} />
    </div>
  );
}

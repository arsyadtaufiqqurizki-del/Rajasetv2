import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer } from 'recharts';
import { formatCompactCurrency, formatCurrencyWhole } from '../lib/money';
import type { DashboardChartPoint } from '../hooks/useDashboardMetrics';
import AllSubsidiariesModal from './AllSubsidiariesModal';

interface DashboardSubsidiaryBarChartProps {
  data: DashboardChartPoint[];
  allData: DashboardChartPoint[];
}

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
      <div className="h-64 w-full">
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
              formatter={(value) => [formatCurrencyWhole(Number(value)), 'Valuation']}
            />
            <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} barSize={24}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: string | number | boolean | null | undefined) => formatCompactCurrency(Number(value ?? 0))}
                fill="var(--color-on-surface)"
                fontSize={12}
                fontWeight={500}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <AllSubsidiariesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={allData} />
    </div>
  );
}

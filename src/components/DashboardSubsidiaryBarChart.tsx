import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrencyWhole } from '../lib/money';
import type { DashboardChartPoint } from '../hooks/useDashboardMetrics';

interface DashboardSubsidiaryBarChartProps {
  data: DashboardChartPoint[];
}

export default function DashboardSubsidiaryBarChart({ data }: DashboardSubsidiaryBarChartProps) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm lg:col-span-2">
      <h3 className="text-lg font-semibold text-primary mb-4">Top 5 Subsidiaries by Valuation</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#45464d', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #c6c6cd' }}
              formatter={(value) => [formatCurrencyWhole(Number(value)), 'Valuation']}
            />
            <Bar dataKey="value" fill="#0F172A" radius={[0, 4, 4, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

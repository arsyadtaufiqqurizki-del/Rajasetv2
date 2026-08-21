import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrencyWhole, formatCompactNumber } from '../lib/money';
import type { DashboardTrendPoint } from '../hooks/useDashboardMetrics';

interface DashboardTrendChartProps {
  data: DashboardTrendPoint[];
  selectedYear: string;
  availableYears: string[];
  onSelectYear: (year: string) => void;
}

export default function DashboardTrendChart({ data, selectedYear, availableYears, onSelectYear }: DashboardTrendChartProps) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-primary">Tren Pembelian Aset Tahunan</h3>
        <select
          value={selectedYear}
          onChange={(e) => onSelectYear(e.target.value)}
          className="bg-surface-container-low border border-outline-variant rounded-md px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e3e5" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#76777d', fontSize: 12 }} dy={10} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#76777d', fontSize: 12 }}
              tickFormatter={(value: number) => formatCompactNumber(value)}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              formatter={(value) => [formatCurrencyWhole(Number(value)), 'Nilai Pembelian']}
            />
            <Line type="monotone" dataKey="value" stroke="#0F172A" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

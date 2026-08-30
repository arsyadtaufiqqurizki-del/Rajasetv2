import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrencyWhole, formatCompactNumber } from '../lib/money';
import type { DashboardTrendPoint, DashboardTrendSeries } from '../hooks/useDashboardMetrics';

interface DashboardTrendChartProps {
  data: DashboardTrendPoint[];
  subsidiaries: DashboardTrendSeries[];
  selectedYear: string;
  availableYears: string[];
  onSelectYear: (year: string) => void;
}

type TrendMode = 'total' | 'subsidiary';

export default function DashboardTrendChart({ data, subsidiaries, selectedYear, availableYears, onSelectYear }: DashboardTrendChartProps) {
  const [mode, setMode] = useState<TrendMode>('total');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (name: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h3 className="text-base font-semibold text-on-surface">Annual Purchase Trend</h3>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-outline-variant p-0.5 bg-surface-container-low">
            <button
              type="button"
              onClick={() => setMode('total')}
              className={`px-3 py-1 text-sm rounded-sm transition-colors ${mode === 'total' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setMode('subsidiary')}
              className={`px-3 py-1 text-sm rounded-sm transition-colors ${mode === 'subsidiary' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
            >
              By Subsidiary
            </button>
          </div>
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
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-chart-axis)', fontSize: 12 }} dy={10} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-chart-axis)', fontSize: 12 }}
              tickFormatter={(value: number) => formatCompactNumber(value)}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              formatter={(value, name) => [formatCurrencyWhole(Number(value)), mode === 'total' ? 'Purchase Value' : name]}
            />
            {mode === 'subsidiary' && (
              <Legend
                wrapperStyle={{ fontSize: '12px', cursor: 'pointer' }}
                onClick={(entry) => entry.dataKey && toggleSeries(String(entry.dataKey))}
                formatter={(value) => (hiddenSeries.has(value) ? <span style={{ opacity: 0.5 }}>{value}</span> : value)}
              />
            )}
            {mode === 'total' ? (
              <Line type="monotone" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            ) : (
              subsidiaries.map(series => (
                <Line
                  key={series.name}
                  type="monotone"
                  dataKey={series.name}
                  name={series.name}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  hide={hiddenSeries.has(series.name)}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

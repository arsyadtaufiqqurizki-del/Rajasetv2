import { forwardRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import type { ReportPreview } from '../../types/report';
import { formatCurrency } from '../../lib/money';
import { id as copy } from '../../i18n/id';

interface ReportChartProps {
  previewData: ReportPreview | null;
}

const ReportChart = forwardRef<HTMLDivElement, ReportChartProps>(function ReportChart({ previewData }, ref) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col items-center">
      <div className="w-full flex justify-between items-center border-b border-outline-variant pb-3 mb-6">
        <h3 className="text-lg font-semibold text-on-surface">
          {previewData ? `Live Preview: ${previewData.title}` : 'Live Preview: Asset Valuation Summary'}
        </h3>
        {previewData && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Sync Complete
          </div>
        )}
      </div>

      <div ref={ref} className="w-full h-[350px] relative rounded-lg overflow-hidden flex flex-col items-center justify-center bg-white">
        {!previewData ? (
          <div className="absolute inset-0 bg-surface border border-outline-variant/50 rounded-lg flex flex-col items-center justify-center p-6">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
            <span className="text-on-surface-variant text-sm font-medium z-10 bg-surface-container-lowest px-4 py-2 rounded-full border border-outline-variant shadow-sm">{copy.emptyState.noChartData}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {previewData.type === 'bar' ? (
              <BarChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={previewData.yAxisFormatter} tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey={previewData.dataKey} fill={previewData.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : previewData.type === 'line' ? (
              <LineChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={previewData.yAxisFormatter} tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Line type="monotone" dataKey={previewData.dataKey} stroke={previewData.color} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <BarChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={previewData.yAxisFormatter} tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="estimated" name="Estimated Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});

export default ReportChart;

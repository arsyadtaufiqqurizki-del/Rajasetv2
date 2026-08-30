import { forwardRef, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import type { ReportPreview } from '../../types/report';
import { formatCurrency } from '../../lib/money';
import { en as copy } from '../../i18n/en';

interface ReportChartProps {
  previewData: ReportPreview | null;
  generatedAt?: Date | null;
  actions?: ReactNode;
}

const axisTick = { fill: 'var(--color-chart-axis)', fontSize: 12 };
const tooltipContentStyle = {
  borderRadius: '8px',
  border: '1px solid var(--color-chart-grid)',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const ReportChart = forwardRef<HTMLDivElement, ReportChartProps>(function ReportChart({ previewData, generatedAt, actions }, ref) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col items-center">
      <div className="w-full flex justify-between items-center gap-3 flex-wrap border-b border-outline-variant pb-3 mb-6">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-lg font-semibold text-on-surface">
            {previewData ? previewData.title : copy.reports.chart.previewFallbackTitle}
          </h3>
          {previewData && generatedAt && (
            <span className="text-xs text-on-surface-variant">
              {previewData.detailData.length.toLocaleString()} rows · {copy.reports.chart.generatedAtPrefix}{' '}
              {generatedAt.toLocaleDateString()} {generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {previewData?.methodologyNote && (
            <span className="flex items-start gap-1.5 text-xs text-on-surface-variant/80 max-w-2xl">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              {previewData.methodologyNote}
            </span>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div
        ref={ref}
        className="w-full h-[260px] sm:h-[320px] lg:h-[380px] relative rounded-lg overflow-hidden flex flex-col items-center justify-center bg-surface-container-lowest"
        role={previewData ? 'img' : undefined}
        aria-label={previewData ? previewData.title : undefined}
      >
        {!previewData ? (
          <div className="absolute inset-0 bg-surface border border-outline-variant/50 rounded-lg flex flex-col items-center justify-center p-6">
            <div aria-hidden="true" className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
            <span className="text-on-surface-variant text-sm font-medium z-10 bg-surface-container-lowest px-4 py-2 rounded-full border border-outline-variant shadow-sm">{copy.emptyState.noChartData}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {previewData.type === 'bar' ? (
              <BarChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
                <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={previewData.yAxisFormatter} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  cursor={{ fill: 'var(--color-chart-grid)' }}
                  contentStyle={tooltipContentStyle}
                />
                <Bar dataKey={previewData.dataKey} fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : previewData.type === 'line' ? (
              <LineChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
                <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={previewData.yAxisFormatter} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={tooltipContentStyle}
                />
                <Line type="monotone" dataKey={previewData.dataKey} stroke="var(--color-chart-5)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <BarChart data={previewData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
                <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={previewData.yAxisFormatter} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  cursor={{ fill: 'var(--color-chart-grid)' }}
                  contentStyle={tooltipContentStyle}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="estimated" name={copy.reports.chart.estimatedCostLegend} fill="var(--color-chart-7)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name={copy.reports.chart.actualCostLegend} fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});

export default ReportChart;

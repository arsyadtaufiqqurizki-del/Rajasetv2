import { BarChart3 } from 'lucide-react';
import type { ReportSummaryItem } from '../../types/report';
import { parseCost, formatCompactCurrency } from '../../lib/money';
import StatCard from '../ui/StatCard';
import ValueWithTooltip from '../ui/ValueWithTooltip';

const SUMMARY_VALUE_CLASS = 'text-3xl font-semibold text-primary';

interface ReportSummaryCardsProps {
  summary: ReportSummaryItem[];
}

export default function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  if (!summary.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      {summary.map(item => {
        // Every currency summary value is pre-formatted (e.g. "$178,035,432.10") by the
        // builders, same string used in PDF/Excel — only the on-screen card compacts it.
        const isCurrency = item.value.trim().startsWith('$');
        const compactValue = isCurrency ? formatCompactCurrency(parseCost(item.value)) : item.value;
        return (
          <StatCard
            key={item.label}
            label={item.label}
            value={isCurrency ? <ValueWithTooltip value={compactValue} full={item.value} /> : item.value}
            valueClassName={SUMMARY_VALUE_CLASS}
            icon={<BarChart3 className="h-5 w-5 text-primary" />}
          />
        );
      })}
    </div>
  );
}

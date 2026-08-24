import { cn } from '../../lib/utils';

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon: React.ReactNode;
  footer?: React.ReactNode;
  tone?: 'default' | 'danger';
  /** overrides the value's default text-primary color, e.g. to conditionally flag a non-zero count */
  valueClassName?: string;
}

export default function StatCard({ label, value, icon, footer, tone = 'default', valueClassName }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 flex flex-col shadow-sm border',
        tone === 'danger'
          ? 'border-error/20 bg-error-container/5 border-l-4 border-l-error'
          : 'border-outline-variant bg-surface-container-lowest'
      )}
    >
      <div className="flex items-center justify-between text-on-surface-variant font-medium text-xs tracking-wider uppercase mb-3">
        <span>{label}</span>
        {icon}
      </div>
      <div className={cn('text-4xl font-bold mb-2', valueClassName ?? 'text-primary')}>{value}</div>
      {footer && <div className="flex items-center gap-1 text-xs">{footer}</div>}
    </div>
  );
}

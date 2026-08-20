import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  footer?: React.ReactNode;
  tone?: 'default' | 'danger';
}

export default function StatCard({ label, value, icon, footer, tone = 'default' }: StatCardProps) {
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
      <div className="text-4xl font-bold text-primary mb-2">{value}</div>
      {footer && <div className="flex items-center gap-1 text-xs">{footer}</div>}
    </div>
  );
}

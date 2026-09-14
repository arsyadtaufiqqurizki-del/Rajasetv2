import { Table, BarChart3, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

export type MaintenanceView = 'table' | 'timeline' | 'calendar';

interface MaintenanceViewSwitcherProps {
  activeView: MaintenanceView;
  onViewChange: (view: MaintenanceView) => void;
}

const VIEWS: Array<{ id: MaintenanceView; label: string; icon: typeof Table; badge?: string }> = [
  { id: 'table', label: 'Table', icon: Table },
  { id: 'timeline', label: 'Timeline', icon: BarChart3 },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
];

export default function MaintenanceViewSwitcher({ activeView, onViewChange }: MaintenanceViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Maintenance view"
      className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-1"
    >
      {VIEWS.map(({ id, label, icon: Icon, badge }) => {
        const active = activeView === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onViewChange(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge && (
              <span className="rounded-full bg-secondary-container px-1.5 py-px text-[10px] font-semibold text-on-secondary-container">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { Wrench, SearchX } from 'lucide-react';
import EmptyState from './ui/EmptyState';
import { en as copy } from '../i18n/en';

interface MaintenanceEmptyStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onAddNew: () => void;
}

export default function MaintenanceEmptyState({ hasActiveFilters, onClearFilters, onAddNew }: MaintenanceEmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center py-12">
        <EmptyState
          message={copy.emptyState.noMaintenanceFiltered}
          icon={<SearchX className="h-10 w-10 text-on-surface-variant/50" />}
        />
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-2 rounded-lg border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface hover:border-primary hover:text-primary transition-colors"
        >
          Clear Filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-12">
      <EmptyState
        message={copy.emptyState.noMaintenanceData}
        icon={<Wrench className="h-10 w-10 text-on-surface-variant/50" />}
      />
      <button
        type="button"
        onClick={onAddNew}
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 transition-opacity"
      >
        + Add First Record
      </button>
    </div>
  );
}

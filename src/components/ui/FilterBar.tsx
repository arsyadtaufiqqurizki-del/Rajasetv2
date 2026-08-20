import { Filter, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import FilterChips, { type FilterChip } from './FilterChips';

interface FilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPlaceholder?: string;
  chips: FilterChip[];
  onClearFilters: () => void;
  /** filter dropdowns / range inputs, rendered inline after the search box */
  children?: React.ReactNode;
  /** extra classes for the outer wrapper — pages differ on border/rounding/shadow (standalone box vs. nested panel section) */
  className?: string;
}

export default function FilterBar({
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder = 'Search...',
  chips,
  onClearFilters,
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-xs font-semibold text-on-surface-variant uppercase flex items-center gap-1.5 tracking-wider">
          <Filter className="h-4 w-4" /> Filters
          {chips.length > 0 && (
            <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold normal-case tracking-normal">
              {chips.length}
            </span>
          )}
        </span>
        <div className="flex-1 flex flex-wrap gap-2.5 items-center">
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-on-surface-variant" />
            </div>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-md text-sm py-1.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          {children}
        </div>
        <button onClick={onClearFilters} className="text-sm font-medium text-secondary hover:text-primary transition-colors">
          Clear Filters
        </button>
      </div>
      <FilterChips chips={chips} />
    </div>
  );
}

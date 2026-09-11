import { useState } from 'react';
import { ChevronUp, ChevronDown, Filter, Search, X } from 'lucide-react';
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import type { AssetFilterActions, AssetFilterValues, FilterChip } from '../hooks/useAssetFilters';

export interface AssetFilterOptions {
  subsidiaries: string[];
  categories1: string[];
  categories2: string[];
  itemStatuses: string[];
  uniqueStatuses: string[];
}

interface AssetFiltersProps {
  filters: AssetFilterValues;
  actions: AssetFilterActions;
  options: AssetFilterOptions;
  activeFilters: FilterChip[];
}

export default function AssetFilters({
  filters, actions, options, activeFilters,
}: AssetFiltersProps) {
  const {
    subsidiaries, categories1, categories2, itemStatuses, uniqueStatuses,
  } = options;
  const onClearFilters = actions.clearFilters;
  const hiddenActiveCount = [
    filters.location.length > 0,
    filters.listed.length > 0,
    filters.verification.length > 0,
    filters.itemStatus.length > 0,
    Boolean(filters.dateFrom || filters.dateTo),
    Boolean(filters.costMin || filters.costMax),
  ].filter(Boolean).length;

  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(() => hiddenActiveCount > 0);

  return (
    <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-col gap-3 shadow-sm">
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-xs font-semibold text-on-surface-variant uppercase flex items-center gap-1.5 tracking-wider">
          <Filter className="h-4 w-4" /> Filters
          {activeFilters.length > 0 && (
            <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold normal-case tracking-normal">
              {activeFilters.length}
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
              placeholder="Search by ID or Description..."
              value={filters.searchQuery}
              onChange={(e) => actions.setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-md text-sm py-1.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <MultiSelectDropdown
            placeholder="All Subsidiaries"
            options={subsidiaries}
            selected={filters.subsidiary}
            onChange={actions.setSubsidiary}
          />
          <MultiSelectDropdown
            placeholder="All Asset Classes"
            options={categories1}
            selected={filters.category}
            onChange={actions.setCategory}
          />
          <MultiSelectDropdown
            placeholder="All Statuses"
            options={uniqueStatuses}
            selected={filters.status}
            onChange={actions.setStatus}
          />
          <button
            type="button"
            onClick={() => setIsMoreFiltersOpen(prev => !prev)}
            aria-expanded={isMoreFiltersOpen}
            aria-controls="asset-more-filters-panel"
            className="flex items-center gap-1.5 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-3 text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
          >
            More filters
            {hiddenActiveCount > 0 && (
              <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold">
                {hiddenActiveCount}
              </span>
            )}
            {isMoreFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        <button
          onClick={onClearFilters}
          disabled={activeFilters.length === 0}
          className="text-sm font-medium text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-secondary"
        >
          Clear Filters
        </button>
      </div>

      {isMoreFiltersOpen && (
        <div id="asset-more-filters-panel" className="flex flex-wrap gap-2.5 items-center p-3 rounded-lg bg-surface-container-low border border-outline-variant">
          <MultiSelectDropdown
            placeholder="All Locations"
            options={categories2}
            selected={filters.location}
            onChange={actions.setLocation}
            searchable
          />
          <MultiSelectDropdown
            placeholder="All Listed"
            options={['Audited', 'Non-Listed']}
            selected={filters.listed}
            onChange={actions.setListed}
          />
          <MultiSelectDropdown
            placeholder="All Verification"
            options={['Yes', 'No']}
            selected={filters.verification}
            onChange={actions.setVerification}
          />
          <MultiSelectDropdown
            placeholder="All Item Statuses"
            options={itemStatuses}
            selected={filters.itemStatus}
            onChange={actions.setItemStatus}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant whitespace-nowrap" title="This field shows dates using your browser/OS date format, which may not match the DD/MM/YYYY used in the table">
              In service (MM/DD/YYYY):
            </span>
            <input
              type="date"
              lang="en-GB"
              value={filters.dateFrom}
              onChange={(e) => actions.setDateFrom(e.target.value)}
              aria-label="Date place in service from (MM/DD/YYYY)"
              className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
            <span className="text-xs text-on-surface-variant">to</span>
            <input
              type="date"
              lang="en-GB"
              value={filters.dateTo}
              onChange={(e) => actions.setDateTo(e.target.value)}
              aria-label="Date place in service to (MM/DD/YYYY)"
              className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min cost"
              value={filters.costMin}
              onChange={(e) => actions.setCostMin(e.target.value)}
              className="w-28 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
            <span className="text-xs text-on-surface-variant">-</span>
            <input
              type="number"
              placeholder="Max cost"
              value={filters.costMax}
              onChange={(e) => actions.setCostMax(e.target.value)}
              className="w-28 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(chip => (
            <span
              key={chip.id}
              className="flex items-center gap-1.5 bg-surface-container-high border border-outline-variant rounded-full pl-3 pr-1.5 py-1 text-xs text-on-surface"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="p-0.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-error transition-colors"
                aria-label={`Remove filter ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

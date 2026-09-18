import { useState } from 'react';
import { ChevronUp, ChevronDown, Filter, Search, X } from 'lucide-react';
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import type { FilterChip } from '../types/filters';

interface DashboardFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  activeFilters: FilterChip[];
  onClearFilters: () => void;

  subsidiaries: string[];
  filterSubsidiary: string[];
  onFilterSubsidiaryChange: (value: string[]) => void;
  categories1: string[];
  filterCategory: string[];
  onFilterCategoryChange: (value: string[]) => void;
  categories2: string[];
  filterLocation: string[];
  onFilterLocationChange: (value: string[]) => void;
  uniqueStatuses: string[];
  filterStatus: string[];
  onFilterStatusChange: (value: string[]) => void;
  filterListed: string[];
  onFilterListedChange: (value: string[]) => void;
  filterVerification: string[];
  onFilterVerificationChange: (value: string[]) => void;
  itemStatuses: string[];
  filterItemStatus: string[];
  onFilterItemStatusChange: (value: string[]) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  costMin: string;
  onCostMinChange: (value: string) => void;
  costMax: string;
  onCostMaxChange: (value: string) => void;
}

/** The dashboard's single, page-wide filter — every KPI, chart, and table below reads the same filtered set. */
export default function DashboardFilterBar({
  searchQuery,
  onSearchQueryChange,
  activeFilters,
  onClearFilters,
  subsidiaries,
  filterSubsidiary,
  onFilterSubsidiaryChange,
  categories1,
  filterCategory,
  onFilterCategoryChange,
  categories2,
  filterLocation,
  onFilterLocationChange,
  uniqueStatuses,
  filterStatus,
  onFilterStatusChange,
  filterListed,
  onFilterListedChange,
  filterVerification,
  onFilterVerificationChange,
  itemStatuses,
  filterItemStatus,
  onFilterItemStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  costMin,
  onCostMinChange,
  costMax,
  onCostMaxChange,
}: DashboardFilterBarProps) {
  const hiddenActiveCount = [
    filterLocation.length > 0,
    filterListed.length > 0,
    filterVerification.length > 0,
    filterItemStatus.length > 0,
    Boolean(dateFrom || dateTo),
    Boolean(costMin || costMax),
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
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-md text-sm py-1.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <MultiSelectDropdown
            placeholder="All Subsidiaries"
            options={subsidiaries}
            selected={filterSubsidiary}
            onChange={onFilterSubsidiaryChange}
          />
          <MultiSelectDropdown
            placeholder="All Asset Classes"
            options={categories1}
            selected={filterCategory}
            onChange={onFilterCategoryChange}
          />
          <MultiSelectDropdown
            placeholder="All Statuses"
            options={uniqueStatuses}
            selected={filterStatus}
            onChange={onFilterStatusChange}
          />
          <button
            type="button"
            onClick={() => setIsMoreFiltersOpen(prev => !prev)}
            aria-expanded={isMoreFiltersOpen}
            aria-controls="dashboard-more-filters-panel"
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
        <div id="dashboard-more-filters-panel" className="flex flex-wrap gap-2.5 items-center p-3 rounded-lg bg-surface-container-low border border-outline-variant">
          <MultiSelectDropdown
            placeholder="All Locations"
            options={categories2}
            selected={filterLocation}
            onChange={onFilterLocationChange}
            searchable
          />
          <MultiSelectDropdown
            placeholder="All Listed"
            options={['Audited', 'Non-Listed']}
            selected={filterListed}
            onChange={onFilterListedChange}
          />
          <MultiSelectDropdown
            placeholder="All Verification"
            options={['Yes', 'No']}
            selected={filterVerification}
            onChange={onFilterVerificationChange}
          />
          <MultiSelectDropdown
            placeholder="All Item Statuses"
            options={itemStatuses}
            selected={filterItemStatus}
            onChange={onFilterItemStatusChange}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant whitespace-nowrap" title="This field shows dates using your browser/OS date format, which may not match the DD/MM/YYYY used in the table">
              In service (MM/DD/YYYY):
            </span>
            <input
              type="date"
              lang="en-GB"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              aria-label="Date place in service from (MM/DD/YYYY)"
              className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
            <span className="text-xs text-on-surface-variant">to</span>
            <input
              type="date"
              lang="en-GB"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              aria-label="Date place in service to (MM/DD/YYYY)"
              className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min cost"
              value={costMin}
              onChange={(e) => onCostMinChange(e.target.value)}
              className="w-28 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
            <span className="text-xs text-on-surface-variant">-</span>
            <input
              type="number"
              placeholder="Max cost"
              value={costMax}
              onChange={(e) => onCostMaxChange(e.target.value)}
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

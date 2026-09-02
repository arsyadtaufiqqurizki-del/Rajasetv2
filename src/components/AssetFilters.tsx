import { Filter, Search, X } from 'lucide-react';
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import type { FilterChip } from '../hooks/useAssetFilters';

interface AssetFiltersProps {
  subsidiaries: string[];
  categories1: string[];
  categories2: string[];
  itemStatuses: string[];
  uniqueStatuses: string[];

  filterSubsidiary: string[];
  setFilterSubsidiary: (v: string[]) => void;
  filterCategory: string[];
  setFilterCategory: (v: string[]) => void;
  filterLocation: string[];
  setFilterLocation: (v: string[]) => void;
  filterStatus: string[];
  setFilterStatus: (v: string[]) => void;
  filterVerification: string[];
  setFilterVerification: (v: string[]) => void;
  filterItemStatus: string[];
  setFilterItemStatus: (v: string[]) => void;

  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  costMin: string;
  setCostMin: (v: string) => void;
  costMax: string;
  setCostMax: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;

  activeFilters: FilterChip[];
  onClearFilters: () => void;
}

export default function AssetFilters({
  subsidiaries, categories1, categories2, itemStatuses, uniqueStatuses,
  filterSubsidiary, setFilterSubsidiary,
  filterCategory, setFilterCategory,
  filterLocation, setFilterLocation,
  filterStatus, setFilterStatus,
  filterVerification, setFilterVerification,
  filterItemStatus, setFilterItemStatus,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  costMin, setCostMin,
  costMax, setCostMax,
  searchQuery, setSearchQuery,
  activeFilters, onClearFilters,
}: AssetFiltersProps) {
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-md text-sm py-1.5 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <MultiSelectDropdown
            placeholder="All Subsidiaries"
            options={subsidiaries}
            selected={filterSubsidiary}
            onChange={setFilterSubsidiary}
          />
          <MultiSelectDropdown
            placeholder="All Asset Classes"
            options={categories1}
            selected={filterCategory}
            onChange={setFilterCategory}
          />
          <MultiSelectDropdown
            placeholder="All Locations"
            options={categories2}
            selected={filterLocation}
            onChange={setFilterLocation}
            searchable
          />
          <MultiSelectDropdown
            placeholder="All Statuses"
            options={uniqueStatuses}
            selected={filterStatus}
            onChange={setFilterStatus}
          />
          <MultiSelectDropdown
            placeholder="All Verification"
            options={['Yes', 'No']}
            selected={filterVerification}
            onChange={setFilterVerification}
          />
          <MultiSelectDropdown
            placeholder="All Item Statuses"
            options={itemStatuses}
            selected={filterItemStatus}
            onChange={setFilterItemStatus}
          />
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Date place in service from"
              className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
            <span className="text-xs text-on-surface-variant">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Date place in service to"
              className="bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Min cost"
              value={costMin}
              onChange={(e) => setCostMin(e.target.value)}
              className="w-28 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
            <span className="text-xs text-on-surface-variant">-</span>
            <input
              type="number"
              placeholder="Max cost"
              value={costMax}
              onChange={(e) => setCostMax(e.target.value)}
              className="w-28 bg-surface border border-outline-variant rounded-md text-sm py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
        </div>
        <button
          onClick={onClearFilters}
          className="text-sm font-medium text-secondary hover:text-primary transition-colors"
        >
          Clear Filters
        </button>
      </div>
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

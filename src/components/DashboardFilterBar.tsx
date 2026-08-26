import FilterBar from './ui/FilterBar';
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
}: DashboardFilterBarProps) {
  return (
    <FilterBar
      className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm"
      searchQuery={searchQuery}
      onSearchQueryChange={onSearchQueryChange}
      searchPlaceholder="Search by ID or Description..."
      chips={activeFilters}
      onClearFilters={onClearFilters}
    >
      <MultiSelectDropdown
        placeholder="All Subsidiaries"
        options={subsidiaries}
        selected={filterSubsidiary}
        onChange={onFilterSubsidiaryChange}
      />
      <MultiSelectDropdown
        placeholder="All Categories"
        options={categories1}
        selected={filterCategory}
        onChange={onFilterCategoryChange}
      />
      <MultiSelectDropdown
        placeholder="All Locations"
        options={categories2}
        selected={filterLocation}
        onChange={onFilterLocationChange}
      />
      <MultiSelectDropdown
        placeholder="All Statuses"
        options={uniqueStatuses}
        selected={filterStatus}
        onChange={onFilterStatusChange}
      />
    </FilterBar>
  );
}

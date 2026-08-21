import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/money';
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import FilterBar from './ui/FilterBar';
import Pagination from './ui/Pagination';
import { TableEmptyRow } from './ui/EmptyState';
import type { Asset } from '../types/asset';
import type { FilterChip } from '../types/filters';

interface DashboardRecentAssetsPanelProps {
  currentAssets: Asset[];
  filteredCount: number;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;

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

export default function DashboardRecentAssetsPanel({
  currentAssets,
  filteredCount,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
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
}: DashboardRecentAssetsPanelProps) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col mt-2">
      <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
        <h3 className="text-lg font-semibold text-primary">Recent Asset Additions</h3>
      </div>
      <FilterBar
        className="p-4 border-b border-outline-variant bg-surface-container-lowest"
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
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-surface-container text-on-surface-variant text-xs font-medium uppercase tracking-wider">
              <th className="p-3 pl-5">Asset Book</th>
              <th className="p-3">Subsidiaries</th>
              <th className="p-3">Asset Number</th>
              <th className="p-3 min-w-[300px]">Asset Description</th>
              <th className="p-3 text-right">Asset Cost</th>
              <th className="p-3">Date Place in Service</th>
              <th className="p-3">Asset Units</th>
              <th className="p-3">Asset Class</th>
              <th className="p-3">Location</th>
              <th className="p-3">Depreciation Method</th>
              <th className="p-3 text-center">Life in Months</th>
              <th className="p-3">Listed</th>
              <th className="p-3 text-center pr-5">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-outline-variant/50">
            {currentAssets.map((asset) => (
              <tr key={asset.id} className="hover:bg-surface-container-low transition-colors">
                <td className="p-3 pl-5 font-mono text-secondary text-xs">
                  {(() => {
                    const bookId = asset.assetBook || asset.id;
                    return bookId.length > 5 ? (
                      <span title={bookId}>{bookId.slice(0, 5)}&hellip;</span>
                    ) : (
                      bookId
                    );
                  })()}
                </td>
                <td className="p-3 text-on-surface text-xs">{asset.subsidiary}</td>
                <td className="p-3 font-mono text-on-surface text-xs">{asset.assetNumber}</td>
                <td className="p-3 text-on-surface font-semibold min-w-[300px] max-w-[300px]">
                  <span className="block truncate" title={asset.assetDescription}>
                    {asset.assetDescription}
                  </span>
                </td>
                <td className="p-3 text-on-surface-variant text-right font-mono tabular-nums">{formatCurrency(asset.assetCost)}</td>
                <td className="p-3 text-on-surface font-mono text-xs whitespace-nowrap">{asset.datePlaceInService}</td>
                <td className="p-3 text-on-surface-variant">{asset.assetUnits}</td>
                <td className="p-3 text-on-surface">{asset.categorySegment1}</td>
                <td className="p-3 text-on-surface">{asset.categorySegment2}</td>
                <td className="p-3 text-on-surface-variant">{asset.depreciationMethod}</td>
                <td className="p-3 text-on-surface text-center">{asset.lifeInMonths}</td>
                <td className="p-3 text-on-surface-variant">{asset.listed}</td>
                <td className="p-3 text-center pr-5">
                  <span className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border',
                    asset.statusLevel === 'success' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    asset.statusLevel === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    asset.statusLevel === 'error' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-surface-container-high text-on-surface border-outline-variant/50'
                  )}>
                    {asset.status}
                  </span>
                </td>
              </tr>
            ))}
            {filteredCount === 0 && (
              <TableEmptyRow colSpan={13} message="Belum ada data asset" />
            )}
          </tbody>
        </table>
      </div>
      {filteredCount > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          visibleCount={currentAssets.length}
          totalCount={filteredCount}
          onPrev={onPrevPage}
          onNext={onNextPage}
          itemLabel="assets"
        />
      )}
    </div>
  );
}

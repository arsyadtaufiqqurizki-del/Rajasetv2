import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Loader2, Plus } from 'lucide-react';
import { formatLastUpdate, startOfToday } from '../lib/dates';
import { computeBookValue } from '../lib/depreciation';
import { formatCompactCurrency, formatCurrencyWhole } from '../lib/money';
import { sanitizeCell, toCsvBlob, downloadBlob } from '../lib/csv';

import { useAsset } from '../contexts/AssetContext';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import DashboardFilterBar from '../components/DashboardFilterBar';
import DashboardKpiRow from '../components/DashboardKpiRow';
import DashboardAttentionRow from '../components/DashboardAttentionRow';
import DashboardSubsidiaryBarChart from '../components/DashboardSubsidiaryBarChart';
import DashboardCategoryPieChart from '../components/DashboardCategoryPieChart';
import DashboardTrendChart from '../components/DashboardTrendChart';
import DashboardRecentAssetsPanel from '../components/DashboardRecentAssetsPanel';
import DashboardSkeleton from '../components/DashboardSkeleton';
import type { AssetStatusOption } from '../hooks/useDashboardMetrics';

const ITEMS_PER_PAGE = 10;

export default function Dashboard() {
  const {
    assets, subsidiaries, categories1, categories2, lastFetchedAt,
    loading, error, refetch, setIsAddModalOpen,
  } = useAsset();

  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [currentPage, setCurrentPage] = useState(1);

  const {
    filterSubsidiary, setFilterSubsidiary,
    filterCategory, setFilterCategory,
    filterLocation, setFilterLocation,
    filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    uniqueStatuses,
    activeFilters,
    filteredAssets,
    clearFilters,
  } = useDashboardFilters(assets, searchParams, setSearchParams, () => setCurrentPage(1));

  const {
    assetCountChange,
    assetCostChange,
    statusCounts,
    totalValuation,
    formattedValuation,
    fullValuation,
    subsidiaryData,
    allSubsidiaryData,
    categoryData,
    availableYears,
    trendData,
  } = useDashboardMetrics(filteredAssets, selectedYear);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentAssets = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ITEMS_PER_PAGE));

  const asOf = useMemo(() => startOfToday(), []);
  const bookValues = useMemo(
    () => new Map(assets.map(a => [a.id, computeBookValue(a, asOf).bookValue])),
    [assets, asOf]
  );

  // Sums the already-computed per-asset book values over the current filter scope, rather than
  // re-running computeBookValue — the Map above already paid that cost once for all assets.
  const totalBookValue = useMemo(
    () => filteredAssets.reduce((sum, a) => sum + (bookValues.get(a.id) ?? 0), 0),
    [filteredAssets, bookValues]
  );
  const totalAccumulatedDepreciation = Math.max(0, totalValuation - totalBookValue);
  const bookValueRatio = totalValuation > 0 ? (totalBookValue / totalValuation) * 100 : 0;
  const depreciationRatio = totalValuation > 0 ? (totalAccumulatedDepreciation / totalValuation) * 100 : 0;

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleToggleStatus = (status: AssetStatusOption) => {
    setFilterStatus(
      filterStatus.includes(status) ? filterStatus.filter((s) => s !== status) : [...filterStatus, status]
    );
  };

  const handleExport = () => {
    if (filteredAssets.length === 0) return;
    setIsExporting(true);
    setTimeout(() => {
      const rows = filteredAssets.map((asset) => ({
        'Asset Number': sanitizeCell(asset.assetNumber),
        'Asset Description': sanitizeCell(asset.assetDescription),
        'Subsidiary': sanitizeCell(asset.subsidiary),
        'Asset Cost': asset.assetCost,
        'Book Value': bookValues.get(asset.id) ?? 0,
        'Status': sanitizeCell(asset.status),
      }));
      downloadBlob(`Dashboard_Assets_${new Date().toISOString().split('T')[0]}.csv`, toCsvBlob(rows));
      setIsExporting(false);
    }, 0);
  };

  const isFiltered = filteredAssets.length !== assets.length;
  const viewAllHref = searchParams.toString() ? `/inventory?${searchParams.toString()}` : '/inventory';

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold tracking-tight text-primary">Overview Dashboard</h2>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1">
            {lastFetchedAt && <span>Last updated: {formatLastUpdate(lastFetchedAt)}</span>}
            {lastFetchedAt && isFiltered && <span aria-hidden="true">|</span>}
            {isFiltered && (
              <span aria-live="polite">
                Showing {filteredAssets.length} of {assets.length} assets
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || filteredAssets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface-variant rounded-md hover:text-primary hover:border-primary font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md hover:opacity-90 font-medium text-sm transition-opacity shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </button>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center rounded-xl border border-outline-variant bg-surface-container-lowest">
          <AlertTriangle className="h-10 w-10 text-error" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold text-on-surface">Failed to load dashboard data</p>
            <p className="mt-1 text-sm text-on-surface-variant">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <DashboardFilterBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            activeFilters={activeFilters}
            onClearFilters={clearFilters}
            subsidiaries={subsidiaries}
            filterSubsidiary={filterSubsidiary}
            onFilterSubsidiaryChange={setFilterSubsidiary}
            categories1={categories1}
            filterCategory={filterCategory}
            onFilterCategoryChange={setFilterCategory}
            categories2={categories2}
            filterLocation={filterLocation}
            onFilterLocationChange={setFilterLocation}
            uniqueStatuses={uniqueStatuses}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
          />

          <DashboardKpiRow
            assetsCount={filteredAssets.length}
            assetCountChange={assetCountChange}
            formattedValuation={formattedValuation}
            fullValuation={fullValuation}
            assetCostChange={assetCostChange}
            formattedBookValue={formatCompactCurrency(totalBookValue)}
            fullBookValue={formatCurrencyWhole(totalBookValue)}
            bookValueRatio={bookValueRatio}
            formattedDepreciation={formatCompactCurrency(totalAccumulatedDepreciation)}
            fullDepreciation={formatCurrencyWhole(totalAccumulatedDepreciation)}
            depreciationRatio={depreciationRatio}
          />

          <DashboardAttentionRow
            statusCounts={statusCounts}
            filterStatus={filterStatus}
            onToggleStatus={handleToggleStatus}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DashboardSubsidiaryBarChart data={subsidiaryData} allData={allSubsidiaryData} />
            <DashboardCategoryPieChart data={categoryData} totalValueFormatted={formattedValuation} />
          </div>

          <DashboardTrendChart
            data={trendData}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onSelectYear={setSelectedYear}
          />

          <DashboardRecentAssetsPanel
            currentAssets={currentAssets}
            bookValues={bookValues}
            filteredCount={filteredAssets.length}
            page={currentPage}
            totalPages={totalPages}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            viewAllHref={viewAllHref}
          />
        </>
      )}
    </div>
  );
}

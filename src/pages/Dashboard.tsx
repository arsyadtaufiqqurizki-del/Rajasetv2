import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatLastUpdate } from '../lib/dates';

import { useAsset } from '../contexts/AssetContext';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import DashboardKpiRow from '../components/DashboardKpiRow';
import DashboardSubsidiaryBarChart from '../components/DashboardSubsidiaryBarChart';
import DashboardCategoryPieChart from '../components/DashboardCategoryPieChart';
import DashboardTrendChart from '../components/DashboardTrendChart';
import DashboardRecentAssetsPanel from '../components/DashboardRecentAssetsPanel';
import type { AssetStatusOption } from '../hooks/useDashboardMetrics';

const ITEMS_PER_PAGE = 10;

export default function Dashboard() {
  const { assets, subsidiaries, categories1, categories2, lastFetchedAt } = useAsset();

  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<AssetStatusOption>('Broken');

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
    formattedValuation,
    fullValuation,
    subsidiaryData,
    categoryData,
    availableYears,
    trendData,
  } = useDashboardMetrics(assets, selectedYear);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentAssets = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ITEMS_PER_PAGE));

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div className="mb-2 flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-primary">Overview Dashboard</h2>
        </div>
        {lastFetchedAt && (
          <span className="text-xs text-on-surface-variant mt-1">
            Terakhir diperbarui: {formatLastUpdate(lastFetchedAt)}
          </span>
        )}
      </div>

      <DashboardKpiRow
        assetsCount={assets.length}
        assetCountChange={assetCountChange}
        formattedValuation={formattedValuation}
        fullValuation={fullValuation}
        assetCostChange={assetCostChange}
        statusCounts={statusCounts}
        selectedStatus={selectedStatus}
        onSelectedStatusChange={setSelectedStatus}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashboardSubsidiaryBarChart data={subsidiaryData} />
        <DashboardCategoryPieChart data={categoryData} totalAssets={assets.length} />
      </div>

      <DashboardTrendChart
        data={trendData}
        selectedYear={selectedYear}
        availableYears={availableYears}
        onSelectYear={setSelectedYear}
      />

      <DashboardRecentAssetsPanel
        currentAssets={currentAssets}
        filteredCount={filteredAssets.length}
        page={currentPage}
        totalPages={totalPages}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
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
    </div>
  );
}

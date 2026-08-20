import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import { Package, TrendingUp, TrendingDown, AlertTriangle, FileUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatCurrency, formatCurrencyWhole, formatCompactCurrency, formatCompactNumber, parseCost } from '../lib/money';
import { formatLastUpdate } from '../lib/dates';

import { useAsset } from '../contexts/AssetContext';
import { useDashboardFilters } from '../hooks/useDashboardFilters';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import FilterBar from '../components/ui/FilterBar';

export default function Dashboard() {
  const { assets, subsidiaries, categories1, categories2, lastFetchedAt } = useAsset();

  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const currentMonthAssets = assets.filter(a => {
    const d = new Date(a.createdAt);
    return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const lastMonthAssets = assets.filter(a => {
    const d = new Date(a.createdAt);
    return !isNaN(d.getTime()) && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  });

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const assetCountChange = calculateChange(currentMonthAssets.length, lastMonthAssets.length);
  
  const currentMonthCost = currentMonthAssets.reduce((acc, curr) => acc + parseCost(curr.assetCost), 0);

  const lastMonthCost = lastMonthAssets.reduce((acc, curr) => acc + parseCost(curr.assetCost), 0);

  const assetCostChange = calculateChange(currentMonthCost, lastMonthCost);

  const brokenAssetsCount = assets.filter(a => a.statusLevel === 'error').length;
  const brokenAssetPercentage = assets.length > 0 ? (brokenAssetsCount / assets.length) * 100 : 0;

  const totalValuation = assets.reduce((acc, curr) => acc + parseCost(curr.assetCost), 0);

  const formattedValuation = formatCompactCurrency(totalValuation);

  const fullValuation = formatCurrencyWhole(totalValuation);

  const subsidiaryDataMap = assets.reduce((acc, curr) => {
    const value = parseCost(curr.assetCost);
    const subsidiaryName = curr.subsidiary || "Unknown";
    acc[subsidiaryName] = (acc[subsidiaryName] || 0) + value;
    return acc;
  }, {} as Record<string, number>);

  const subsidiaryData = Object.entries(subsidiaryDataMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 5);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const categoryDataMap = assets.reduce((acc, curr) => {
    const value = parseCost(curr.assetCost);
    const categoryName = curr.categorySegment1 || "Uncategorized";
    acc[categoryName] = (acc[categoryName] || 0) + value;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryDataMap)
    .map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length]
    }))
    .sort((a, b) => (b.value as number) - (a.value as number));

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(
      assets
        .map(asset => {
          const date = new Date(asset.datePlaceInService);
          return isNaN(date.getTime()) ? null : date.getFullYear().toString();
        })
        .filter(Boolean)
    )) as string[];

    if (years.length === 0) years.push(new Date().getFullYear().toString());
    return years.sort((a, b) => b.localeCompare(a));
  }, [assets]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const trendDataMap = useMemo(() => assets.reduce((acc, curr) => {
    const date = new Date(curr.datePlaceInService);
    if (!isNaN(date.getTime()) && date.getFullYear().toString() === selectedYear) {
      const monthIndex = date.getMonth();
      acc[monthIndex] = (acc[monthIndex] || 0) + parseCost(curr.assetCost);
    }
    return acc;
  }, {} as Record<number, number>), [assets, selectedYear]);

  const trendData = months.map((month, index) => ({
    month,
    value: trendDataMap[index] || 0
  }));

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAssets = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / itemsPerPage));

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant font-medium text-xs tracking-wider uppercase mb-3">
            <span>Asset Units</span>
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="text-4xl font-bold text-primary mb-2">{assets.length}</div>
          <div className="flex items-center gap-1 text-xs">
            {assetCountChange !== 0 ? (
              <>
                <span className={cn("flex items-center font-medium", assetCountChange > 0 ? "text-emerald-600" : "text-red-600")}>
                  {assetCountChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {Math.abs(assetCountChange).toFixed(1)}%
                </span>
                <span className="text-on-surface-variant">vs last month</span>
              </>
            ) : (
              <span className="text-on-surface-variant font-medium">No change from last month</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant font-medium text-xs tracking-wider uppercase mb-3">
            <span>Asset Cost</span>
            <FileUp className="h-5 w-5 text-primary" />
          </div>
          <div className="relative group w-fit">
            <div className="text-4xl font-bold text-primary mb-2 cursor-default">{formattedValuation}</div>
            <div
              className="pointer-events-none absolute left-0 bottom-full mb-1 whitespace-nowrap rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium text-[#45464d] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
              style={{ borderColor: '#c6c6cd' }}
            >
              {fullValuation}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {assetCostChange !== 0 ? (
              <>
                <span className={cn("flex items-center font-medium", assetCostChange > 0 ? "text-emerald-600" : "text-red-600")}>
                  {assetCostChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {Math.abs(assetCostChange).toFixed(1)}%
                </span>
                <span className="text-on-surface-variant">vs last month</span>
              </>
            ) : (
              <span className="text-on-surface-variant font-medium">No change from last month</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-error/20 bg-error-container/5 p-5 flex flex-col shadow-sm border-l-4 border-l-error">
          <div className="flex items-center justify-between text-on-surface-variant font-medium text-xs tracking-wider uppercase mb-3">
            <span>Broken Asset</span>
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <div className="text-4xl font-bold text-primary mb-2">{brokenAssetsCount}</div>
          <div className="flex items-center gap-1 text-xs">
            <span className={cn("font-medium", brokenAssetPercentage > 10 ? "text-red-600" : "text-amber-600")}>
              {brokenAssetPercentage.toFixed(1)}%
            </span>
            <span className="text-on-surface-variant">of total assets</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-primary mb-4">Top 5 Subsidiaries by Valuation</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subsidiaryData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} 
                  tick={{ fill: '#45464d', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #c6c6cd' }}
                  formatter={(value) => [
                    formatCurrencyWhole(Number(value)),
                    'Valuation'
                  ]}
                />
                <Bar dataKey="value" fill="#0F172A" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm flex flex-col">
          <h3 className="text-lg font-semibold text-primary mb-4">Asset Categories</h3>
          <div className="flex-1 min-h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    formatCurrencyWhole(Number(value)),
                    'Valuation'
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-2">
              <span className="text-2xl font-bold text-primary">{assets.length}</span>
              <span className="text-xs text-on-surface-variant">Asset Class</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {categoryData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-primary">Tren Pembelian Aset Tahunan</h3>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-surface-container-low border border-outline-variant rounded-md px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e3e5" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#76777d', fontSize: 12 }} dy={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#76777d', fontSize: 12 }}
                tickFormatter={(value: number) => formatCompactNumber(value)}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                formatter={(value) => [
                  formatCurrencyWhole(Number(value)),
                  'Nilai Pembelian'
                ]}
              />
              <Line type="monotone" dataKey="value" stroke="#0F172A" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col mt-2">
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-lg font-semibold text-primary">Recent Asset Additions</h3>
        </div>
        <FilterBar
          className="p-4 border-b border-outline-variant bg-surface-container-lowest"
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchPlaceholder="Search by ID or Description..."
          chips={activeFilters}
          onClearFilters={clearFilters}
        >
          <MultiSelectDropdown
            placeholder="All Subsidiaries"
            options={subsidiaries}
            selected={filterSubsidiary}
            onChange={setFilterSubsidiary}
          />
          <MultiSelectDropdown
            placeholder="All Categories"
            options={categories1}
            selected={filterCategory}
            onChange={setFilterCategory}
          />
          <MultiSelectDropdown
            placeholder="All Locations"
            options={categories2}
            selected={filterLocation}
            onChange={setFilterLocation}
          />
          <MultiSelectDropdown
            placeholder="All Statuses"
            options={uniqueStatuses}
            selected={filterStatus}
            onChange={setFilterStatus}
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
              {currentAssets.map((asset, i) => (
                <tr key={i} className="hover:bg-surface-container-low transition-colors">
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
                      "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border",
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
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-on-surface-variant">Belum ada data asset</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredAssets.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant bg-surface-container-lowest">
            <div className="text-sm text-on-surface-variant">
              Showing <span className="font-medium text-on-surface">{indexOfFirstItem + 1}</span> to <span className="font-medium text-on-surface">{Math.min(indexOfLastItem, filteredAssets.length)}</span> of <span className="font-medium text-on-surface">{filteredAssets.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-1 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium text-on-surface px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

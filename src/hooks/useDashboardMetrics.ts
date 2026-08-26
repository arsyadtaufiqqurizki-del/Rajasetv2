import { useMemo } from 'react';
import type { Asset } from '../types/asset';
import { formatCurrencyWhole, formatCompactCurrency, parseCost } from '../lib/money';

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const ASSET_STATUS_OPTIONS = ['Active', 'In Maintenance', 'Needs Service', 'Broken', 'Retired'] as const;
export type AssetStatusOption = typeof ASSET_STATUS_OPTIONS[number];

export interface DashboardChartPoint {
  name: string;
  value: number;
}

export interface DashboardCategoryPoint extends DashboardChartPoint {
  color: string;
}

export interface DashboardTrendPoint {
  month: string;
  value: number;
}

/** Returns null (no comparable baseline) rather than a misleading 100% when last month had no data. */
function calculateChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function useDashboardMetrics(assets: Asset[], selectedYear: string) {
  const summary = useMemo(() => {
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

    const assetCountChange = calculateChange(currentMonthAssets.length, lastMonthAssets.length);

    const currentMonthCost = currentMonthAssets.reduce((acc, curr) => acc + parseCost(curr.assetCost), 0);
    const lastMonthCost = lastMonthAssets.reduce((acc, curr) => acc + parseCost(curr.assetCost), 0);
    const assetCostChange = calculateChange(currentMonthCost, lastMonthCost);

    const statusCounts = ASSET_STATUS_OPTIONS.reduce((acc, statusOption) => {
      acc[statusOption] = assets.filter(a => a.status.trim().toLowerCase() === statusOption.toLowerCase()).length;
      return acc;
    }, {} as Record<AssetStatusOption, number>);

    const totalValuation = assets.reduce((acc, curr) => acc + parseCost(curr.assetCost), 0);
    const formattedValuation = formatCompactCurrency(totalValuation);
    const fullValuation = formatCurrencyWhole(totalValuation);

    const subsidiaryDataMap = assets.reduce((acc, curr) => {
      const value = parseCost(curr.assetCost);
      const subsidiaryName = curr.subsidiary || 'Unknown';
      acc[subsidiaryName] = (acc[subsidiaryName] || 0) + value;
      return acc;
    }, {} as Record<string, number>);

    const allSubsidiaryData: DashboardChartPoint[] = Object.entries(subsidiaryDataMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const subsidiaryData = allSubsidiaryData.slice(0, 5);

    const categoryDataMap = assets.reduce((acc, curr) => {
      const value = parseCost(curr.assetCost);
      const categoryName = curr.categorySegment1 || 'Uncategorized';
      acc[categoryName] = (acc[categoryName] || 0) + value;
      return acc;
    }, {} as Record<string, number>);

    const categoryData: DashboardCategoryPoint[] = Object.entries(categoryDataMap)
      .map(([name, value], index) => ({
        name,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    const years = Array.from(new Set(
      assets
        .map(asset => {
          const date = new Date(asset.datePlaceInService);
          return isNaN(date.getTime()) ? null : date.getFullYear().toString();
        })
        .filter((y): y is string => Boolean(y))
    ));
    if (years.length === 0) years.push(new Date().getFullYear().toString());
    const availableYears = years.sort((a, b) => b.localeCompare(a));

    return {
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
    };
  }, [assets]);

  const trendData = useMemo<DashboardTrendPoint[]>(() => {
    const trendDataMap = assets.reduce((acc, curr) => {
      const date = new Date(curr.datePlaceInService);
      if (!isNaN(date.getTime()) && date.getFullYear().toString() === selectedYear) {
        const monthIndex = date.getMonth();
        acc[monthIndex] = (acc[monthIndex] || 0) + parseCost(curr.assetCost);
      }
      return acc;
    }, {} as Record<number, number>);

    return MONTHS.map((month, index) => ({ month, value: trendDataMap[index] || 0 }));
  }, [assets, selectedYear]);

  return { ...summary, trendData };
}

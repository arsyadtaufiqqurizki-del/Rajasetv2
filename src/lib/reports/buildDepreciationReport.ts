import type { Asset } from '../../types/asset';
import type { DepreciationReportPreview } from '../../types/report';
import { formatCurrency, parseCost } from '../money';
import { monthsBetween, getQuartersInRange } from '../dates';
import { compactCurrencyAxisFormatter, filterBySubsidiary } from './shared';

export function buildDepreciationReport(
  assets: Asset[],
  subsidiary: string,
  start: Date,
  end: Date,
): DepreciationReportPreview {
  const filteredAssets = assets.filter(filterBySubsidiary(subsidiary));
  const quarters = getQuartersInRange(start, end);

  const data = quarters.map(q => {
    const totalValue = filteredAssets.reduce((sum, a) => {
      const cost = parseCost(a.assetCost);
      const life = parseInt(a.lifeInMonths) || 60;
      const placedInService = a.datePlaceInService ? new Date(a.datePlaceInService) : null;
      if (!placedInService) return sum + cost;
      const ageMonths = monthsBetween(placedInService, q.endDate);
      const remaining = life > 0 ? Math.max(0, cost * (1 - Math.min(ageMonths, life) / life)) : 0;
      return sum + remaining;
    }, 0);
    return { name: q.label, value: totalValue };
  });

  const totalOriginalCost = filteredAssets.reduce((sum, a) => sum + parseCost(a.assetCost), 0);
  const netBookValue = data.length ? data[data.length - 1].value : totalOriginalCost;

  return {
    type: 'line',
    title: 'Depreciated Value Over Year',
    data,
    dataKey: 'value',
    color: '#8b5cf6',
    yAxisFormatter: compactCurrencyAxisFormatter,
    summary: [
      { label: 'Total Original Cost', value: formatCurrency(totalOriginalCost) },
      { label: `Net Book Value (${quarters[quarters.length - 1]?.label ?? 'End'})`, value: formatCurrency(netBookValue) },
      { label: 'Total Depreciation', value: formatCurrency(totalOriginalCost - netBookValue) },
      { label: 'Total Assets', value: filteredAssets.length.toLocaleString() },
    ],
    detailColumns: [
      { key: 'assetNumber', label: 'Asset Number' },
      { key: 'description', label: 'Description' },
      { key: 'cost', label: 'Cost', currency: true },
      { key: 'accumulatedDepreciation', label: 'Accumulated Depreciation', currency: true },
      { key: 'netBookValue', label: 'Net Book Value', currency: true },
      { key: 'remainingLifeMonths', label: 'Remaining Life (Months)' },
    ],
    detailData: filteredAssets.map(a => {
      const cost = parseCost(a.assetCost);
      const life = parseInt(a.lifeInMonths) || 60;
      const placedInService = a.datePlaceInService ? new Date(a.datePlaceInService) : null;
      const ageMonths = placedInService ? monthsBetween(placedInService, end) : 0;
      const netBookValueAtEnd = placedInService ? Math.max(0, cost * (1 - Math.min(ageMonths, life) / life)) : cost;
      return {
        assetNumber: a.assetNumber,
        description: a.assetDescription,
        cost,
        accumulatedDepreciation: cost - netBookValueAtEnd,
        netBookValue: netBookValueAtEnd,
        remainingLifeMonths: Math.max(0, life - Math.min(ageMonths, life)),
      };
    }),
  };
}

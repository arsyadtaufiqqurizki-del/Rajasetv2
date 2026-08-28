import type { Asset } from '../../types/asset';
import type { DepreciationReportPreview } from '../../types/report';
import { formatCurrency, parseCost } from '../money';
import { getQuartersInRange } from '../dates';
import { computeBookValue } from '../depreciation';
import { compactCurrencyAxisFormatter } from './shared';

export function buildDepreciationReport(
  assets: Asset[],
  start: Date,
  end: Date,
): DepreciationReportPreview {
  const filteredAssets = assets;
  const quarters = getQuartersInRange(start, end);

  const data = quarters.map(q => {
    const totalValue = filteredAssets.reduce(
      (sum, a) => sum + computeBookValue(a, q.endDate).bookValue, 0
    );
    return { name: q.label, value: totalValue };
  });

  const totalOriginalCost = filteredAssets.reduce((sum, a) => sum + parseCost(a.assetCost), 0);
  const netBookValue = data.length ? data[data.length - 1].value : totalOriginalCost;

  return {
    type: 'line',
    title: 'Depreciated Value Over Year',
    data,
    dataKey: 'value',
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
      const { cost, accumulatedDepreciation, bookValue, remainingLifeMonths } = computeBookValue(a, end);
      return {
        assetNumber: a.assetNumber,
        description: a.assetDescription,
        cost,
        accumulatedDepreciation,
        netBookValue: bookValue,
        remainingLifeMonths: remainingLifeMonths ?? 0,
      };
    }),
  };
}

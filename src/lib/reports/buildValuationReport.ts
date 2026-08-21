import type { Asset } from '../../types/asset';
import type { AssetValuationReportPreview } from '../../types/report';
import { formatCurrency, parseCost } from '../money';
import { compactCurrencyAxisFormatter, filterBySubsidiary } from './shared';

export function buildValuationReport(
  assets: Asset[],
  subsidiary: string,
  start: Date,
  end: Date,
): AssetValuationReportPreview {
  const filteredAssets = assets.filter(filterBySubsidiary(subsidiary)).filter(a => {
    if (!a.datePlaceInService) return true;
    const d = new Date(a.datePlaceInService);
    return d >= start && d <= end;
  });

  const grouped = filteredAssets.reduce<Record<string, number>>((acc, asset) => {
    const cat = asset.categorySegment1 || 'Uncategorized';
    const cost = parseCost(asset.assetCost);
    acc[cat] = (acc[cat] || 0) + cost;
    return acc;
  }, {});

  const totalValue = Object.values(grouped).reduce((sum, v) => sum + v, 0);

  return {
    type: 'bar',
    title: 'Asset Valuation by Category',
    data: Object.keys(grouped).map(k => ({ name: k, value: grouped[k] })),
    dataKey: 'value',
    color: '#3b82f6',
    yAxisFormatter: compactCurrencyAxisFormatter,
    summary: [
      { label: 'Total Asset Value', value: formatCurrency(totalValue) },
      { label: 'Total Assets', value: filteredAssets.length.toLocaleString() },
      { label: 'Categories', value: Object.keys(grouped).length.toLocaleString() },
      { label: 'Avg Value / Asset', value: formatCurrency(filteredAssets.length ? totalValue / filteredAssets.length : 0) },
    ],
    detailColumns: [
      { key: 'assetNumber', label: 'Asset Number' },
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'subsidiary', label: 'Subsidiary' },
      { key: 'acquisitionDate', label: 'Acquisition Date' },
      { key: 'cost', label: 'Cost', currency: true },
    ],
    detailData: filteredAssets.map(a => ({
      assetNumber: a.assetNumber,
      description: a.assetDescription,
      category: a.categorySegment1 || 'Uncategorized',
      subsidiary: a.subsidiary,
      acquisitionDate: a.datePlaceInService || '-',
      cost: parseCost(a.assetCost),
    })),
  };
}

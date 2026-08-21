import { Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/money';
import { id as copy } from '../i18n/id';
import type { Asset } from '../contexts/AssetContext';

interface AssetTableProps {
  paginatedAssets: Asset[];
  filteredAssets: Asset[];
  selectedAssets: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectAsset: (assetId: string, checked: boolean) => void;
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (assetId: string) => void;
}

export default function AssetTable({
  paginatedAssets,
  filteredAssets,
  selectedAssets,
  onSelectAll,
  onSelectAsset,
  onEditAsset,
  onDeleteAsset,
}: AssetTableProps) {
  return (
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0">
          <tr>
            <th className="py-3 px-4 w-12 text-center">
              <input
                type="checkbox"
                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                checked={filteredAssets.length > 0 && filteredAssets.every(a => selectedAssets.has(a.id))}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Actions</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Book</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Subsidiaries</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Number</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Description</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider text-right">Asset Cost</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Date Place in Service</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Units</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Class</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Location</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Depreciation Method</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Life in Months</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Listed</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Status</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Verification</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Verification Date</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Item Status</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-outline-variant/30">
          {paginatedAssets.length > 0 ? paginatedAssets.map((asset) => (
            <tr key={asset.id} className={cn("hover:bg-surface-container-low/50 transition-colors group", selectedAssets.has(asset.id) && "bg-primary/5")}>
              <td className="py-4 px-4 text-center">
                <input
                  type="checkbox"
                  className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  checked={selectedAssets.has(asset.id)}
                  onChange={(e) => onSelectAsset(asset.id, e.target.checked)}
                />
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEditAsset(asset)}
                    className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                    title="Edit Asset"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDeleteAsset(asset.id)}
                    className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-error hover:border-error transition-colors"
                    title="Delete Asset"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
              <td className="py-4 px-4 font-mono text-secondary text-xs">{asset.assetBook || asset.id}</td>
              <td className="py-4 px-4 text-on-surface text-xs">{asset.subsidiary}</td>
              <td className="py-4 px-4 font-mono text-on-surface text-xs">{asset.assetNumber}</td>
              <td className="py-4 px-4 font-semibold text-on-surface">{asset.assetDescription}</td>
              <td className="py-4 px-4 text-on-surface-variant text-right font-mono tabular-nums">{formatCurrency(asset.assetCost)}</td>
              <td className="py-4 px-4 text-on-surface font-mono text-xs">{asset.datePlaceInService}</td>
              <td className="py-4 px-4 text-on-surface-variant">{asset.assetUnits}</td>
              <td className="py-4 px-4 text-on-surface">{asset.categorySegment1}</td>
              <td className="py-4 px-4 text-on-surface">{asset.categorySegment2}</td>
              <td className="py-4 px-4 text-on-surface-variant">{asset.depreciationMethod}</td>
              <td className="py-4 px-4 text-on-surface text-center">{asset.lifeInMonths}</td>
              <td className="py-4 px-4 text-on-surface-variant">{asset.listed}</td>
              <td className="py-4 px-4 text-center">
                <span className={cn(
                  "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
                  asset.statusLevel === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                  asset.statusLevel === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" :
                  asset.statusLevel === 'error' ? "bg-error-container/40 border-error/20 text-on-error-container" :
                  "bg-surface-variant text-on-surface-variant border-outline-variant/50"
                )}>
                  {asset.status}
                </span>
              </td>
              <td className="py-4 px-4 text-center">
                <span className={cn(
                  "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
                  asset.verification ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-surface-variant text-on-surface-variant border-outline-variant/50"
                )}>
                  {asset.verification ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="py-4 px-4 text-on-surface font-mono text-xs">{asset.verificationDate}</td>
              <td className="py-4 px-4 text-on-surface-variant">{asset.itemStatus}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan={18} className="py-8 text-center text-on-surface-variant">{copy.emptyState.noAssetData}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

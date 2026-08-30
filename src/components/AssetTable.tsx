import type { ReactNode } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/money';
import { id as copy } from '../i18n/id';
import type { Asset } from '../contexts/AssetContext';

export interface AssetColumnDef {
  id: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string | ((asset: Asset, bookValues: Map<string, number>) => string);
  render: (asset: Asset, bookValues: Map<string, number>) => ReactNode;
}

export const ASSET_COLUMNS: AssetColumnDef[] = [
  {
    id: 'assetBook',
    label: 'Asset Book',
    cellClassName: 'py-4 px-4 font-mono text-secondary text-xs',
    render: (asset) => asset.assetBook || asset.id,
  },
  {
    id: 'subsidiary',
    label: 'Subsidiaries',
    cellClassName: 'py-4 px-4 text-on-surface text-xs',
    render: (asset) => asset.subsidiary,
  },
  {
    id: 'assetNumber',
    label: 'Asset Number',
    cellClassName: 'py-4 px-4 font-mono text-on-surface text-xs',
    render: (asset) => asset.assetNumber,
  },
  {
    id: 'assetDescription',
    label: 'Asset Description',
    cellClassName: 'py-4 px-4 font-semibold text-on-surface',
    render: (asset) => asset.assetDescription,
  },
  {
    id: 'assetCost',
    label: 'Asset Cost',
    headerClassName: 'text-right',
    cellClassName: 'py-4 px-4 text-on-surface-variant text-right font-mono tabular-nums',
    render: (asset) => formatCurrency(asset.assetCost),
  },
  {
    id: 'bookValue',
    label: 'Book Value',
    headerClassName: 'text-right',
    cellClassName: (asset, bookValues) => cn(
      "py-4 px-4 text-right font-mono tabular-nums",
      bookValues.get(asset.id) === 0 ? "text-on-surface-variant/60" : "text-on-surface-variant"
    ),
    render: (asset, bookValues) => asset.assetCost === '' ? '-' : formatCurrency(bookValues.get(asset.id) ?? 0),
  },
  {
    id: 'datePlaceInService',
    label: 'Date Place in Service',
    cellClassName: 'py-4 px-4 text-on-surface font-mono text-xs',
    render: (asset) => asset.datePlaceInService,
  },
  {
    id: 'assetUnits',
    label: 'Asset Units',
    cellClassName: 'py-4 px-4 text-on-surface-variant',
    render: (asset) => asset.assetUnits,
  },
  {
    id: 'categorySegment1',
    label: 'Asset Class',
    cellClassName: 'py-4 px-4 text-on-surface',
    render: (asset) => asset.categorySegment1,
  },
  {
    id: 'categorySegment2',
    label: 'Location',
    cellClassName: 'py-4 px-4 text-on-surface',
    render: (asset) => asset.categorySegment2,
  },
  {
    id: 'depreciationMethod',
    label: 'Depreciation Method',
    cellClassName: 'py-4 px-4 text-on-surface-variant',
    render: (asset) => asset.depreciationMethod,
  },
  {
    id: 'lifeInMonths',
    label: 'Life in Months',
    cellClassName: 'py-4 px-4 text-on-surface text-center',
    render: (asset) => asset.lifeInMonths,
  },
  {
    id: 'listed',
    label: 'Listed',
    cellClassName: 'py-4 px-4 text-on-surface-variant',
    render: (asset) => asset.listed,
  },
  {
    id: 'status',
    label: 'Status',
    headerClassName: 'text-center',
    cellClassName: 'py-4 px-4 text-center',
    render: (asset) => (
      <span className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
        asset.statusLevel === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
        asset.statusLevel === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" :
        asset.statusLevel === 'error' ? "bg-error-container/40 border-error/20 text-on-error-container" :
        "bg-surface-variant text-on-surface-variant border-outline-variant/50"
      )}>
        {asset.status}
      </span>
    ),
  },
  {
    id: 'verification',
    label: 'Verification',
    headerClassName: 'text-center',
    cellClassName: 'py-4 px-4 text-center',
    render: (asset) => (
      <span className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
        asset.verification ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-surface-variant text-on-surface-variant border-outline-variant/50"
      )}>
        {asset.verification ? 'Yes' : 'No'}
      </span>
    ),
  },
  {
    id: 'verificationDate',
    label: 'Verification Date',
    cellClassName: 'py-4 px-4 text-on-surface font-mono text-xs',
    render: (asset) => asset.verificationDate,
  },
  {
    id: 'itemStatus',
    label: 'Item Status',
    cellClassName: 'py-4 px-4 text-on-surface-variant',
    render: (asset) => asset.itemStatus,
  },
];

export const DEFAULT_VISIBLE_COLUMNS = ASSET_COLUMNS.map(c => c.id);

interface AssetTableProps {
  paginatedAssets: Asset[];
  filteredAssets: Asset[];
  selectedAssets: Set<string>;
  bookValues: Map<string, number>;
  visibleColumns: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectAsset: (assetId: string, checked: boolean) => void;
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (assetId: string) => void;
}

export default function AssetTable({
  paginatedAssets,
  filteredAssets,
  selectedAssets,
  bookValues,
  visibleColumns,
  onSelectAll,
  onSelectAsset,
  onEditAsset,
  onDeleteAsset,
}: AssetTableProps) {
  const columns = ASSET_COLUMNS.filter(col => visibleColumns.has(col.id));
  const colSpan = columns.length + 2; // + checkbox column + actions column

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
            {columns.map(col => (
              <th
                key={col.id}
                className={cn(
                  "py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider",
                  col.headerClassName
                )}
              >
                {col.label}
              </th>
            ))}
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
              {columns.map(col => (
                <td
                  key={col.id}
                  className={typeof col.cellClassName === 'function' ? col.cellClassName(asset, bookValues) : col.cellClassName}
                >
                  {col.render(asset, bookValues)}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={colSpan} className="py-8 text-center text-on-surface-variant">{copy.emptyState.noAssetData}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

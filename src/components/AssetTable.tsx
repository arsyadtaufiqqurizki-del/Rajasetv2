import type { ReactNode } from 'react';
import { Edit2, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/money';
import { formatDateDMY } from '../lib/dates';
import { TableEmptyRow } from './ui/EmptyState';
import { en as copy } from '../i18n/en';
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
    cellClassName: 'py-4 px-4 font-mono text-secondary text-xs whitespace-nowrap',
    render: (asset) => asset.assetBook || '—',
  },
  {
    id: 'subsidiary',
    label: 'Subsidiaries',
    cellClassName: 'py-4 px-4 text-on-surface text-xs whitespace-nowrap',
    render: (asset) => asset.subsidiary,
  },
  {
    id: 'assetNumber',
    label: 'Asset Number',
    cellClassName: 'py-4 px-4 font-mono text-on-surface text-xs truncate',
    render: (asset) => asset.assetNumber,
  },
  {
    id: 'assetDescription',
    label: 'Asset Description',
    cellClassName: 'py-4 px-4 font-semibold text-on-surface truncate',
    render: (asset) => <span title={asset.assetDescription}>{asset.assetDescription}</span>,
  },
  {
    id: 'assetCost',
    label: 'Asset Cost',
    headerClassName: 'text-right',
    cellClassName: 'py-4 px-4 text-on-surface-variant text-right font-mono tabular-nums whitespace-nowrap',
    render: (asset) => formatCurrency(asset.assetCost),
  },
  {
    id: 'bookValue',
    label: 'Book Value',
    headerClassName: 'text-right',
    cellClassName: (asset, bookValues) => cn(
      "py-4 px-4 text-right font-mono tabular-nums whitespace-nowrap",
      bookValues.get(asset.id) === 0 ? "text-on-surface-variant/60" : "text-on-surface-variant"
    ),
    render: (asset, bookValues) => asset.assetCost === '' ? '-' : formatCurrency(bookValues.get(asset.id) ?? 0),
  },
  {
    id: 'datePlaceInService',
    label: 'Date Place in Service',
    cellClassName: 'py-4 px-4 text-on-surface font-mono text-xs whitespace-nowrap',
    render: (asset) => formatDateDMY(asset.datePlaceInService),
  },
  {
    id: 'assetUnits',
    label: 'Asset Units',
    cellClassName: 'py-4 px-4 text-on-surface-variant whitespace-nowrap',
    render: (asset) => asset.assetUnits,
  },
  {
    id: 'categorySegment1',
    label: 'Asset Class',
    cellClassName: 'py-4 px-4 text-on-surface whitespace-nowrap',
    render: (asset) => asset.categorySegment1,
  },
  {
    id: 'categorySegment2',
    label: 'Location',
    cellClassName: 'py-4 px-4 text-on-surface whitespace-nowrap',
    render: (asset) => asset.categorySegment2,
  },
  {
    id: 'depreciationMethod',
    label: 'Depreciation Method',
    cellClassName: 'py-4 px-4 text-on-surface-variant whitespace-nowrap',
    render: (asset) => asset.depreciationMethod,
  },
  {
    id: 'lifeInMonths',
    label: 'Life in Months',
    cellClassName: 'py-4 px-4 text-on-surface text-center whitespace-nowrap',
    render: (asset) => asset.lifeInMonths,
  },
  {
    id: 'listed',
    label: 'Listed',
    cellClassName: 'py-4 px-4 text-on-surface-variant whitespace-nowrap',
    render: (asset) => asset.listed,
  },
  {
    id: 'status',
    label: 'Status',
    headerClassName: 'text-center',
    cellClassName: 'py-4 px-4 text-center whitespace-nowrap',
    render: (asset) => (
      <span className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
        asset.statusLevel === 'success' ? "bg-success-container/40 border-success/20 text-on-success-container" :
        asset.statusLevel === 'warning' ? "bg-warning-container/40 border-warning/20 text-on-warning-container" :
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
    cellClassName: 'py-4 px-4 text-center whitespace-nowrap',
    render: (asset) => (
      <span className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
        asset.verification ? "bg-success-container/40 border-success/20 text-on-success-container" : "bg-surface-variant text-on-surface-variant border-outline-variant/50"
      )}>
        {asset.verification ? 'Yes' : 'No'}
      </span>
    ),
  },
  {
    id: 'verificationDate',
    label: 'Verification Date',
    cellClassName: 'py-4 px-4 text-on-surface font-mono text-xs whitespace-nowrap',
    render: (asset) => formatDateDMY(asset.verificationDate),
  },
  {
    id: 'itemStatus',
    label: 'Item Status',
    cellClassName: 'py-4 px-4 text-on-surface-variant whitespace-nowrap',
    render: (asset) => asset.itemStatus,
  },
];

export const DEFAULT_VISIBLE_COLUMNS = ASSET_COLUMNS.map(c => c.id);

/** CSV export header + raw value per column id — kept 1:1 with ASSET_COLUMNS so export can follow column visibility (IA-9). */
export const ASSET_CSV_FIELDS: Record<string, { header: string; value: (asset: Asset, bookValues: Map<string, number>) => unknown }> = {
  assetBook: { header: 'Asset Book', value: (asset) => asset.assetBook },
  subsidiary: { header: 'Subsidiary', value: (asset) => asset.subsidiary },
  assetNumber: { header: 'Asset Number', value: (asset) => asset.assetNumber },
  assetDescription: { header: 'Asset Description', value: (asset) => asset.assetDescription },
  assetCost: { header: 'Asset Cost', value: (asset) => asset.assetCost },
  bookValue: { header: 'Book Value', value: (asset, bookValues) => bookValues.get(asset.id) ?? 0 },
  datePlaceInService: { header: 'Date Place In Service', value: (asset) => asset.datePlaceInService },
  assetUnits: { header: 'Asset Units', value: (asset) => asset.assetUnits },
  categorySegment1: { header: 'Asset Category Segment 1', value: (asset) => asset.categorySegment1 },
  categorySegment2: { header: 'Asset Category Segment 2', value: (asset) => asset.categorySegment2 },
  depreciationMethod: { header: 'Depreciation Method', value: (asset) => asset.depreciationMethod },
  lifeInMonths: { header: 'Life in Months', value: (asset) => asset.lifeInMonths },
  listed: { header: 'Listed', value: (asset) => asset.listed },
  status: { header: 'Status', value: (asset) => asset.status },
  verification: { header: 'Verification', value: (asset) => asset.verification ? 'Yes' : 'No' },
  verificationDate: { header: 'Verification Date', value: (asset) => asset.verificationDate },
  itemStatus: { header: 'Item Status', value: (asset) => asset.itemStatus },
};

/** Rendered as sticky columns (after checkbox + Actions) so row identity survives horizontal scroll — see VD-2. */
const IDENTITY_COLUMN_IDS = ['assetNumber', 'assetDescription'];
const IDENTITY_COLUMN_WIDTHS: Record<string, number> = { assetNumber: 132, assetDescription: 220 };
const CHECKBOX_WIDTH = 48;
const ACTIONS_WIDTH = 88;

const TH_BASE = "py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider";

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
  sortKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  /** presence of a column id here is what makes that header clickable */
  sortableColumns?: Record<string, (asset: Asset) => string | number>;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onAddNew?: () => void;
  onRowClick?: (asset: Asset) => void;
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
  sortKey,
  sortDirection,
  onSort,
  sortableColumns,
  hasActiveFilters,
  onClearFilters,
  onAddNew,
  onRowClick,
}: AssetTableProps) {
  const columns = ASSET_COLUMNS.filter(col => visibleColumns.has(col.id));
  const identityColumns = IDENTITY_COLUMN_IDS
    .map(id => columns.find(col => col.id === id))
    .filter((col): col is AssetColumnDef => col !== undefined);
  const restColumns = columns.filter(col => !IDENTITY_COLUMN_IDS.includes(col.id));
  const colSpan = columns.length + 2; // + checkbox column + actions column

  const stickyLeft: Record<string, number> = { checkbox: 0, actions: CHECKBOX_WIDTH };
  let cursor = CHECKBOX_WIDTH + ACTIONS_WIDTH;
  for (const col of identityColumns) {
    stickyLeft[col.id] = cursor;
    cursor += IDENTITY_COLUMN_WIDTHS[col.id] ?? 140;
  }
  const lastStickyId = identityColumns.length > 0 ? identityColumns[identityColumns.length - 1].id : 'actions';

  const renderHeaderLabel = (col: AssetColumnDef) => {
    if (!sortableColumns?.[col.id] || !onSort) return col.label;
    const active = sortKey === col.id;
    return (
      <button
        type="button"
        onClick={() => onSort(col.id)}
        className="inline-flex items-center gap-1 hover:text-on-surface transition-colors"
      >
        <span>{col.label}</span>
        {active ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    );
  };

  return (
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left border-collapse">
        <caption className="sr-only">Asset inventory · {filteredAssets.length.toLocaleString()} assets</caption>
        <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-20">
          <tr>
            <th
              scope="col"
              className="py-3 px-4 w-12 text-center sticky z-20 bg-surface-container-low"
              style={{ left: stickyLeft.checkbox }}
            >
              <input
                type="checkbox"
                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                checked={filteredAssets.length > 0 && filteredAssets.every(a => selectedAssets.has(a.id))}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = selectedAssets.size > 0 && !(filteredAssets.length > 0 && filteredAssets.every(a => selectedAssets.has(a.id)));
                  }
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                aria-label="Select all assets matching the current filters"
              />
            </th>
            <th
              scope="col"
              className={cn(TH_BASE, "sticky z-20 bg-surface-container-low", lastStickyId === 'actions' && "border-r-2 border-outline-variant")}
              style={{ left: stickyLeft.actions }}
            >
              Actions
            </th>
            {identityColumns.map(col => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  TH_BASE,
                  col.headerClassName,
                  "sticky z-20 bg-surface-container-low",
                  col.id === lastStickyId && "border-r-2 border-outline-variant"
                )}
                style={{ left: stickyLeft[col.id], width: IDENTITY_COLUMN_WIDTHS[col.id], maxWidth: IDENTITY_COLUMN_WIDTHS[col.id] }}
              >
                {renderHeaderLabel(col)}
              </th>
            ))}
            {restColumns.map(col => (
              <th key={col.id} scope="col" className={cn(TH_BASE, col.headerClassName)}>
                {renderHeaderLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-outline-variant/30">
          {paginatedAssets.length > 0 ? paginatedAssets.map((asset) => {
            const rowSelected = selectedAssets.has(asset.id);
            const stickyBg = rowSelected ? "bg-primary/5" : "bg-surface-container-lowest group-hover:bg-surface-container-low/50";
            return (
              <tr
                key={asset.id}
                className={cn(
                  "hover:bg-surface-container-low/50 transition-colors group",
                  rowSelected && "bg-primary/5",
                  onRowClick && "cursor-pointer"
                )}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(asset)}
                onKeyDown={(e) => {
                  if (!onRowClick) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick(asset);
                  }
                }}
              >
                <td
                  className={cn("py-4 px-4 text-center sticky z-10", stickyBg)}
                  style={{ left: stickyLeft.checkbox }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    checked={rowSelected}
                    onChange={(e) => onSelectAsset(asset.id, e.target.checked)}
                    aria-label={`Select asset ${asset.assetNumber || asset.assetDescription}`}
                  />
                </td>
                <td
                  className={cn("py-4 px-4 sticky z-10", stickyBg, lastStickyId === 'actions' && "border-r-2 border-outline-variant")}
                  style={{ left: stickyLeft.actions }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
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
                {identityColumns.map(col => (
                  <td
                    key={col.id}
                    className={cn(
                      typeof col.cellClassName === 'function' ? col.cellClassName(asset, bookValues) : col.cellClassName,
                      "sticky z-10",
                      stickyBg,
                      col.id === lastStickyId && "border-r-2 border-outline-variant"
                    )}
                    style={{ left: stickyLeft[col.id], width: IDENTITY_COLUMN_WIDTHS[col.id], maxWidth: IDENTITY_COLUMN_WIDTHS[col.id] }}
                  >
                    {col.render(asset, bookValues)}
                  </td>
                ))}
                {restColumns.map(col => (
                  <td
                    key={col.id}
                    className={typeof col.cellClassName === 'function' ? col.cellClassName(asset, bookValues) : col.cellClassName}
                  >
                    {col.render(asset, bookValues)}
                  </td>
                ))}
              </tr>
            );
          }) : (
            <TableEmptyRow
              colSpan={colSpan}
              message={hasActiveFilters ? copy.emptyState.noAssetDataFiltered : copy.emptyState.noAssetData}
              action={
                hasActiveFilters
                  ? onClearFilters && (
                    <button
                      type="button"
                      onClick={onClearFilters}
                      className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface hover:border-primary hover:text-primary transition-colors"
                    >
                      Clear filters
                    </button>
                  )
                  : onAddNew && (
                    <button
                      type="button"
                      onClick={onAddNew}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:opacity-90 transition-opacity"
                    >
                      + Add New Asset
                    </button>
                  )
              }
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

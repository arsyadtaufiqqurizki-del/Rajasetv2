import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/money';
import Pagination from './ui/Pagination';
import { TableEmptyRow } from './ui/EmptyState';
import { en as copy } from '../i18n/en';
import type { Asset } from '../types/asset';

interface DashboardRecentAssetsPanelProps {
  currentAssets: Asset[];
  bookValues: Map<string, number>;
  filteredCount: number;
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  /** Inventory link carrying the dashboard's current filters, so "View all" lands on the same scoped result. */
  viewAllHref: string;
}

export default function DashboardRecentAssetsPanel({
  currentAssets,
  bookValues,
  filteredCount,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  viewAllHref,
}: DashboardRecentAssetsPanelProps) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
        <h3 className="text-base font-semibold text-on-surface">Recent Asset Additions</h3>
        <Link to={viewAllHref} className="text-sm font-medium text-primary hover:underline">
          View all &rarr;
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container text-on-surface-variant text-xs font-medium uppercase tracking-wider">
              <th className="p-3 pl-5" scope="col">Asset Number</th>
              <th className="p-3 min-w-[300px]" scope="col">Description</th>
              <th className="p-3" scope="col">Subsidiary</th>
              <th className="p-3 text-right" scope="col">Cost</th>
              <th className="p-3 text-right" scope="col">Book Value</th>
              <th className="p-3 text-center pr-5" scope="col">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-outline-variant/50">
            {currentAssets.map((asset) => (
              <tr key={asset.id} className="hover:bg-surface-container-low transition-colors">
                <td className="p-3 pl-5 font-mono text-on-surface text-xs">{asset.assetNumber}</td>
                <td className="p-3 text-on-surface font-semibold min-w-[300px] max-w-[300px]">
                  <span className="block truncate" title={asset.assetDescription}>
                    {asset.assetDescription}
                  </span>
                </td>
                <td className="p-3 text-on-surface text-xs">{asset.subsidiary}</td>
                <td className="p-3 text-on-surface-variant text-right font-mono tabular-nums">{formatCurrency(asset.assetCost)}</td>
                <td className={cn(
                  "p-3 text-right font-mono tabular-nums",
                  bookValues.get(asset.id) === 0 ? "text-on-surface-variant/80" : "text-on-surface-variant"
                )}>
                  {asset.assetCost === '' ? '-' : formatCurrency(bookValues.get(asset.id) ?? 0)}
                </td>
                <td className="p-3 text-center pr-5">
                  <span className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border',
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
            {filteredCount === 0 && (
              <TableEmptyRow colSpan={6} message={copy.emptyState.noAssetData} />
            )}
          </tbody>
        </table>
      </div>
      {filteredCount > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          visibleCount={currentAssets.length}
          totalCount={filteredCount}
          onPrev={onPrevPage}
          onNext={onNextPage}
          itemLabel="assets"
        />
      )}
    </div>
  );
}

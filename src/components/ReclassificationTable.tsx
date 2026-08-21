import { Edit2, Trash2, CheckCircle2, XCircle, Link2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { TableEmptyRow } from './ui/EmptyState';
import { id as copy } from '../i18n/id';
import type { Reclassification } from '../types/reclassification';

interface ReclassificationTableProps {
  paginatedItems: Reclassification[];
  filteredItems: Reclassification[];
  selectedItems: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectItem: (id: string, checked: boolean) => void;
  onEdit: (item: Reclassification) => void;
  onDelete: (id: string) => void;
  onVerify: (item: Reclassification) => void;
}

function categoryBadgeClass(category: string) {
  if (category === 'Asset') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  if (category === 'Inventory') return 'bg-secondary-container/40 border-outline-variant text-on-secondary-container';
  if (category === 'Needs Review') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-surface-variant text-on-surface-variant border-outline-variant/50';
}

export default function ReclassificationTable({
  paginatedItems,
  filteredItems,
  selectedItems,
  onSelectAll,
  onSelectItem,
  onEdit,
  onDelete,
  onVerify,
}: ReclassificationTableProps) {
  return (
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0">
          <tr>
            <th className="py-3 px-4 w-12 text-center">
              <input
                type="checkbox"
                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                checked={filteredItems.length > 0 && filteredItems.every(item => selectedItems.has(item.id))}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Actions</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Source</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Description</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Asset Category</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Location</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Unit</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Ownership</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Item Status</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Remarks</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap text-center tracking-wider">Verification</th>
            <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase whitespace-nowrap tracking-wider">Verification Date</th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-outline-variant/30">
          {paginatedItems.length > 0 ? paginatedItems.map(item => (
            <tr key={item.id} className={cn('hover:bg-surface-container-low/50 transition-colors group', selectedItems.has(item.id) && 'bg-primary/5')}>
              <td className="py-4 px-4 text-center">
                <input
                  type="checkbox"
                  className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                  checked={selectedItems.has(item.id)}
                  onChange={(e) => onSelectItem(item.id, e.target.checked)}
                />
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(item)}
                    className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                    title="Edit Item"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="p-1.5 rounded bg-surface border border-outline-variant text-on-surface-variant hover:text-error hover:border-error transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
              <td className="py-4 px-4">
                {item.assetId ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md border bg-primary/10 border-primary/30 text-primary whitespace-nowrap">
                    <Link2 className="h-3 w-3" />
                    Linked{item.linkedAssetNumber ? ` (#${item.linkedAssetNumber})` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md border bg-surface-variant text-on-surface-variant border-outline-variant/50 whitespace-nowrap">
                    Manual
                  </span>
                )}
              </td>
              <td className="py-4 px-4 font-semibold text-on-surface">{item.assetDescription}</td>
              <td className="py-4 px-4 text-on-surface">{item.assetCategory || '-'}</td>
              <td className="py-4 px-4 text-on-surface-variant">{item.location || '-'}</td>
              <td className="py-4 px-4 text-on-surface-variant">{item.unit || '-'}</td>
              <td className="py-4 px-4 text-on-surface-variant">{item.ownership || '-'}</td>
              <td className="py-4 px-4">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border',
                  categoryBadgeClass(item.category)
                )}>
                  {item.category}
                </span>
              </td>
              <td className="py-4 px-4 text-on-surface-variant max-w-xs truncate" title={item.remarks}>{item.remarks || '-'}</td>
              <td className="py-4 px-4 text-center">
                <button
                  onClick={() => onVerify(item)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors',
                    item.verified
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                  )}
                >
                  {item.verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {item.verified ? 'Verified' : 'Unverified'}
                </button>
              </td>
              <td className="py-4 px-4 text-on-surface-variant whitespace-nowrap">
                {item.verificationDate
                  ? new Date(item.verificationDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '-'}
              </td>
            </tr>
          )) : (
            <TableEmptyRow colSpan={12} message={copy.emptyState.noReclassificationData} />
          )}
        </tbody>
      </table>
    </div>
  );
}

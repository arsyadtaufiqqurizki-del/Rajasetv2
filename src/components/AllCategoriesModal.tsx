import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Modal from './ui/Modal';
import Pagination from './ui/Pagination';
import { formatCurrencyWhole } from '../lib/money';
import type { DashboardCategoryPoint } from '../hooks/useDashboardMetrics';

interface AllCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DashboardCategoryPoint[];
}

const TITLE_ID = 'all-categories-modal-title';
const ITEMS_PER_PAGE = 10;

export default function AllCategoriesModal({ isOpen, onClose, data }: AllCategoriesModalProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isOpen) setPage(1);
  }, [isOpen]);

  const totalPages = Math.max(1, Math.ceil(data.length / ITEMS_PER_PAGE));
  const indexOfFirstItem = (page - 1) * ITEMS_PER_PAGE;
  const currentItems = data.slice(indexOfFirstItem, indexOfFirstItem + ITEMS_PER_PAGE);

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy={TITLE_ID} className="max-w-3xl">
      <div className="flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 id={TITLE_ID} className="text-xl font-bold text-on-surface">
            All Asset Categories — Asset Cost vs Book Value
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/50 text-xs font-medium text-on-surface-variant">
                <th className="py-2 pr-3 text-left w-8">#</th>
                <th className="py-2 pr-3 text-left">Category</th>
                <th className="py-2 pr-3 text-right">Asset Cost</th>
                <th className="py-2 pr-3 text-right">Book Value</th>
                <th className="py-2 pr-3 text-right">Accum. Depreciation</th>
                <th className="py-2 pl-3 text-right">% Depreciated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {currentItems.map((item, index) => (
                <tr key={item.name}>
                  <td className="py-3 pr-3 text-xs font-mono text-on-surface-variant">
                    {indexOfFirstItem + index + 1}
                  </td>
                  <td className="py-3 pr-3 font-medium text-on-surface">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate max-w-[9rem]" title={item.name}>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums text-on-surface">
                    {formatCurrencyWhole(item.assetCost)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums text-on-surface">
                    {formatCurrencyWhole(item.bookValue)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono tabular-nums text-on-surface-variant">
                    {formatCurrencyWhole(item.accumulatedDepreciation)}
                  </td>
                  <td className="py-3 pl-3 text-right tabular-nums text-on-surface-variant">
                    {item.percentDepreciated.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            visibleCount={currentItems.length}
            totalCount={data.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            itemLabel="categories"
          />
        )}
      </div>
    </Modal>
  );
}

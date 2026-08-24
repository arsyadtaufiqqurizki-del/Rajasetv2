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

  const totalValuation = data.reduce((acc, curr) => acc + curr.value, 0);
  const totalPages = Math.max(1, Math.ceil(data.length / ITEMS_PER_PAGE));
  const indexOfFirstItem = (page - 1) * ITEMS_PER_PAGE;
  const currentItems = data.slice(indexOfFirstItem, indexOfFirstItem + ITEMS_PER_PAGE);

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy={TITLE_ID} className="max-w-lg">
      <div className="flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 id={TITLE_ID} className="text-xl font-bold text-on-surface">
            All Asset Categories by Valuation
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <ul className="divide-y divide-outline-variant/50">
            {currentItems.map((item, index) => {
              const percentage = totalValuation > 0 ? (item.value / totalValuation) * 100 : 0;
              return (
                <li key={item.name} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-on-surface-variant w-5 shrink-0">
                      {indexOfFirstItem + index + 1}
                    </span>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-on-surface truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-on-surface-variant tabular-nums">{percentage.toFixed(1)}%</span>
                    <span className="text-sm font-mono text-on-surface tabular-nums">{formatCurrencyWhole(item.value)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
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

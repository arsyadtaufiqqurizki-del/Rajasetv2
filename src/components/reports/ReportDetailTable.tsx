import { useEffect, useMemo, useState } from 'react';
import type { DetailColumn } from '../../types/report';
import { formatCurrency } from '../../lib/money';
import { cn } from '../../lib/utils';
import { id as copy } from '../../i18n/id';
import Pagination from '../ui/Pagination';

const PAGE_SIZE = 25;

interface ReportDetailTableProps {
  columns: DetailColumn<Record<string, unknown>>[];
  data: Record<string, unknown>[];
}

export default function ReportDetailTable({ columns, data }: ReportDetailTableProps) {
  const [page, setPage] = useState(1);

  // Data is a fresh array on every Generate — reset to page 1 so a new report
  // doesn't silently open on whatever page the previous one left behind.
  useEffect(() => { setPage(1); }, [data]);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return data.slice(start, start + PAGE_SIZE);
  }, [data, page]);

  if (!columns.length || !data.length) return null;

  const heading = copy.reports.detailTable.heading;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-outline-variant flex justify-between items-center">
        <h3 className="text-lg font-semibold text-on-surface">{heading}</h3>
        <span className="text-sm text-on-surface-variant">{data.length.toLocaleString()} baris</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <caption className="sr-only">{heading} · {data.length.toLocaleString()} baris</caption>
          <thead className="bg-surface border-b border-outline-variant">
            <tr>
              {columns.map(col => (
                <th key={col.key} scope="col" className="py-3 px-5 text-xs font-medium text-on-surface-variant">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-outline-variant/40">
            {pageData.map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-container-lowest/50 transition-colors">
                {columns.map(col => {
                  const value = row[col.key];
                  const isOverBudget = col.key === 'variance' && typeof value === 'number' && value > 0;
                  return (
                    <td
                      key={col.key}
                      className={cn('py-3 px-5 text-on-surface-variant', isOverBudget && 'text-error font-semibold')}
                    >
                      {col.currency && typeof value === 'number' ? formatCurrency(value) : String(value ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        visibleCount={pageData.length}
        totalCount={data.length}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
        itemLabel="rows"
      />
    </div>
  );
}

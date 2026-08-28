import { Eye, RotateCcw, Trash2 } from 'lucide-react';
import type { ReportRecord } from '../../contexts/ReportContext';
import { cn } from '../../lib/utils';
import { id as copy } from '../../i18n/id';
import Pagination from '../ui/Pagination';
import Skeleton from '../ui/Skeleton';

interface ReportHistoryTableProps {
  reportHistory: ReportRecord[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  activeId?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onOpen: (report: ReportRecord) => void;
  onRunAgain: (report: ReportRecord) => void;
  onDelete: (id: string) => void;
}

export default function ReportHistoryTable({
  reportHistory, loading, page, totalPages, totalCount, activeId, onPrev, onNext, onOpen, onRunAgain, onDelete,
}: ReportHistoryTableProps) {
  const t = copy.reports.historyTable;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
        <h3 className="text-lg font-semibold text-on-surface">{t.heading}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">{t.heading}</caption>
          <thead className="bg-surface border-b border-outline-variant">
            <tr>
              <th scope="col" className="py-3 px-5 text-xs font-medium text-on-surface-variant">{t.columnName}</th>
              <th scope="col" className="py-3 px-5 text-xs font-medium text-on-surface-variant hidden sm:table-cell">{t.columnCreatedBy}</th>
              <th scope="col" className="py-3 px-5 text-xs font-medium text-on-surface-variant">{t.columnDate}</th>
              <th scope="col" className="py-3 px-5 text-xs font-medium text-on-surface-variant text-right">{t.columnRows}</th>
              <th scope="col" className="py-3 px-5 text-xs font-medium text-on-surface-variant text-right">{t.columnAction}</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-outline-variant/40">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td colSpan={5} className="py-3 px-5"><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : reportHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-on-surface-variant">{t.empty}</td>
              </tr>
            ) : (
              reportHistory.map(report => (
                <tr
                  key={report.id}
                  className={cn(
                    'transition-colors',
                    report.id === activeId ? 'bg-secondary-container/20' : 'hover:bg-surface-container-lowest/50'
                  )}
                >
                  <td className="py-3 px-5 font-medium text-on-surface">{report.reportType} - {report.subsidiary}</td>
                  <td className="py-3 px-5 text-on-surface-variant hidden sm:table-cell">{report.userName}</td>
                  <td className="py-3 px-5 text-on-surface-variant">{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-5 text-on-surface-variant text-right">
                    {report.reportData?.detailData?.length?.toLocaleString() ?? '—'}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onOpen(report)}
                        className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface transition-colors"
                        aria-label={`${t.openAriaPrefix} ${report.reportType} - ${report.subsidiary}`}
                        title={t.open}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onRunAgain(report)}
                        className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface transition-colors"
                        aria-label={`${t.runAgainAriaPrefix} ${report.reportType} - ${report.subsidiary} ${t.runAgainAriaSuffix}`}
                        title={t.runAgain}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(report.id)}
                        className="p-1.5 rounded text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors"
                        aria-label={`${t.deleteAriaPrefix} ${report.reportType} - ${report.subsidiary}`}
                        title={t.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        visibleCount={reportHistory.length}
        totalCount={totalCount}
        onPrev={onPrev}
        onNext={onNext}
        itemLabel="reports"
      />
    </div>
  );
}

import { Trash2 } from 'lucide-react';
import type { ReportRecord } from '../../contexts/ReportContext';
import Pagination from '../ui/Pagination';

interface ReportHistoryTableProps {
  reportHistory: ReportRecord[];
  page: number;
  totalPages: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (id: string) => void;
}

export default function ReportHistoryTable({
  reportHistory, page, totalPages, totalCount, onPrev, onNext, onDelete,
}: ReportHistoryTableProps) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
        <h3 className="text-lg font-semibold text-on-surface">Recent Reports</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className="bg-surface border-b border-outline-variant">
            <tr>
              <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Report Name</th>
              <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Created By</th>
              <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Date</th>
              <th className="py-3 px-5 text-xs font-medium text-on-surface-variant">Status</th>
              <th className="py-3 px-5 text-xs font-medium text-on-surface-variant text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-outline-variant/40">
            {reportHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-on-surface-variant">Belum ada report yang dibuat</td>
              </tr>
            ) : (
              reportHistory.map(report => (
                <tr key={report.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                  <td className="py-3 px-5 font-medium text-on-surface">{report.reportType} - {report.subsidiary}</td>
                  <td className="py-3 px-5 text-on-surface-variant">{report.userName}</td>
                  <td className="py-3 px-5 text-on-surface-variant">{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      {report.status}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      onClick={() => onDelete(report.id)}
                      className="p-1.5 rounded text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

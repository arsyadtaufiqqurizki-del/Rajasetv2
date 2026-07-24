import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';

export type ReportRecord = {
  id: string;
  userName: string;
  reportType: string;
  subsidiary: string;
  dateStart: string;
  dateEnd: string;
  reportData: any;
  status: string;
  createdAt: string;
};

type SaveReportParams = {
  reportType: string;
  subsidiary: string;
  dateStart: string;
  dateEnd: string;
  reportData: any;
};

interface ReportContextType {
  reportHistory: ReportRecord[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  totalCount: number;
  setPage: (page: number) => void;
  saveReport: (params: SaveReportParams) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
}

const PAGE_SIZE = 5;

const ReportContext = createContext<ReportContextType | undefined>(undefined);

const fromDb = (row: any): ReportRecord => ({
  id: row.id,
  userName: row.user_name ?? 'Unknown User',
  reportType: row.report_type ?? '',
  subsidiary: row.subsidiary ?? '',
  dateStart: row.date_start ?? '',
  dateEnd: row.date_end ?? '',
  reportData: row.report_data,
  status: row.status ?? 'Generated',
  createdAt: row.created_at,
});

export function ReportProvider({ children }: { children: ReactNode }) {
  const [reportHistory, setReportHistory] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPage = async (targetPage: number) => {
    setLoading(true);
    const from = (targetPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('report_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) setError(error.message);
    else {
      setReportHistory((data ?? []).map(fromDb));
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const saveReport = async (params: SaveReportParams) => {
    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.full_name
      || user?.email?.split('@')[0]
      || 'Unknown User';

    const { data, error } = await supabase
      .from('report_history')
      .insert({
        user_id: user?.id ?? null,
        user_name: userName,
        report_type: params.reportType,
        subsidiary: params.subsidiary,
        date_start: params.dateStart || null,
        date_end: params.dateEnd || null,
        report_data: params.reportData,
        status: 'Generated',
      })
      .select()
      .single();

    if (error) { setError(error.message); return; }
    logActivity({ actionType: 'GENERATE_REPORT', entityType: 'system', entityId: data.id, details: { reportType: params.reportType, subsidiary: params.subsidiary } });

    if (page === 1) await fetchPage(1);
    else setPage(1);
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase.from('report_history').delete().eq('id', id);
    if (error) { setError(error.message); return; }

    const isLastItemOnPage = reportHistory.length === 1;
    if (isLastItemOnPage && page > 1) setPage(page - 1);
    else await fetchPage(page);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <ReportContext.Provider value={{ reportHistory, loading, error, page, totalPages, totalCount, setPage, saveReport, deleteReport }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReport() {
  const context = useContext(ReportContext);
  if (context === undefined) {
    throw new Error('useReport must be used within a ReportProvider');
  }
  return context;
}

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';

export type MaintenanceRecord = {
  id: string;
  assetBook: string;
  subsidiary: string;
  assetNumber: string;
  assetDescription: string;
  assetUnits: string;
  serviceType: string;
  assetCategorySegment1: string;
  assetCategorySegment2: string;
  estimateCost: string;
  actualCost: string;
  status: string;
  scheduledDate: string;
};

interface MaintenanceContextType {
  records: MaintenanceRecord[];
  loading: boolean;
  error: string | null;
  addRecord: (record: Omit<MaintenanceRecord, 'id'>) => Promise<void>;
  updateRecord: (id: string, record: Omit<MaintenanceRecord, 'id'>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

const parseAmount = (val: string): number | null => {
  const clean = val.replace(/[^\d.]/g, '');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
};

const fromDb = (row: any): MaintenanceRecord => ({
  id: row.id,
  assetBook: row.asset_book ?? '',
  subsidiary: row.subsidiary ?? '',
  assetNumber: row.asset_number ?? '',
  assetDescription: row.asset_description ?? '',
  assetUnits: row.asset_units != null ? String(row.asset_units) : '',
  serviceType: row.service_type ?? '',
  assetCategorySegment1: row.asset_category_segment1 ?? '',
  assetCategorySegment2: row.asset_category_segment2 ?? '',
  estimateCost: row.estimate_cost != null ? String(row.estimate_cost) : '',
  actualCost: row.actual_cost != null ? String(row.actual_cost) : '',
  status: row.status ?? '',
  scheduledDate: row.scheduled_date ?? '',
});

const toDb = (record: Omit<MaintenanceRecord, 'id'>) => ({
  asset_book: record.assetBook,
  subsidiary: record.subsidiary,
  asset_number: record.assetNumber,
  asset_description: record.assetDescription,
  asset_units: record.assetUnits ? parseFloat(record.assetUnits) : null,
  service_type: record.serviceType,
  asset_category_segment1: record.assetCategorySegment1,
  asset_category_segment2: record.assetCategorySegment2,
  estimate_cost: record.estimateCost ? parseAmount(record.estimateCost) : null,
  actual_cost: record.actualCost ? parseAmount(record.actualCost) : null,
  status: record.status,
  scheduled_date: record.scheduledDate || null,
});

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) setError(error.message);
      else setRecords((data ?? []).map(fromDb));

      setLoading(false);
    };
    fetchRecords();
  }, []);

  const addRecord = async (record: Omit<MaintenanceRecord, 'id'>) => {
    const { data, error } = await supabase
      .from('maintenance_records')
      .insert(toDb(record))
      .select()
      .single();

    if (error) { setError(error.message); return; }
    setRecords(prev => [fromDb(data), ...prev]);
    logActivity({ actionType: 'ADD_MAINTENANCE', entityType: 'maintenance', entityId: data.id, details: { assetName: record.assetDescription, scheduledDate: record.scheduledDate } });
  };

  const updateRecord = async (id: string, updated: Omit<MaintenanceRecord, 'id'>) => {
    const existing = records.find(r => r.id === id);
    const { data, error } = await supabase
      .from('maintenance_records')
      .update(toDb(updated))
      .eq('id', id)
      .select()
      .single();

    if (error) { setError(error.message); return; }
    setRecords(prev => prev.map(r => r.id === id ? fromDb(data) : r));
    logActivity({ actionType: 'UPDATE_MAINTENANCE', entityType: 'maintenance', entityId: id, details: { assetName: updated.assetDescription, from: existing?.status, to: updated.status } });
  };

  const deleteRecord = async (id: string) => {
    const { error } = await supabase.from('maintenance_records').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  return (
    <MaintenanceContext.Provider value={{ records, loading, error, addRecord, updateRecord, deleteRecord }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (context === undefined) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
}

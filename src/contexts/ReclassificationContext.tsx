import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';

export type ReclassificationCategory = 'Asset' | 'Needs Review' | 'Inventory' | string;

export const RECLASSIFICATION_PRESET_CATEGORIES = ['Asset', 'Needs Review', 'Inventory'] as const;

export type Reclassification = {
  id: string;
  assetCategory: string;
  assetDescription: string;
  location: string;
  unit: string;
  ownership: string;
  category: ReclassificationCategory;
  remarks: string;
  verified: boolean;
  verificationDate: string;
  verifiedBy: string;
  createdAt: string;
};

export type ReclassificationInput = Omit<
  Reclassification,
  'id' | 'verified' | 'verificationDate' | 'verifiedBy' | 'createdAt'
>;

interface ReclassificationContextType {
  reclassifications: Reclassification[];
  loading: boolean;
  error: string | null;
  addReclassification: (item: ReclassificationInput, skipLog?: boolean) => Promise<void>;
  updateReclassification: (id: string, item: ReclassificationInput) => Promise<void>;
  deleteReclassification: (id: string) => Promise<void>;
  deleteMultipleReclassifications: (ids: string[]) => Promise<void>;
  deleteAllReclassifications: () => Promise<void>;
  verifyReclassification: (id: string, verified: boolean) => Promise<void>;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (isOpen: boolean) => void;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (isOpen: boolean) => void;
  editingReclassification: Reclassification | null;
  setEditingReclassification: (item: Reclassification | null) => void;
  isVerifyModalOpen: boolean;
  setIsVerifyModalOpen: (isOpen: boolean) => void;
  verifyingReclassification: Reclassification | null;
  setVerifyingReclassification: (item: Reclassification | null) => void;
}

const ReclassificationContext = createContext<ReclassificationContextType | undefined>(undefined);

const fromDb = (row: any): Reclassification => ({
  id: row.id,
  assetCategory: row.asset_category ?? '',
  assetDescription: row.asset_description ?? '',
  location: row.location ?? '',
  unit: row.unit != null ? String(row.unit) : '',
  ownership: row.ownership ?? '',
  category: row.category ?? 'Needs Review',
  remarks: row.remarks ?? '',
  verified: row.verified ?? false,
  verificationDate: row.verification_date ?? '',
  verifiedBy: row.verified_by ?? '',
  createdAt: row.created_at ?? '',
});

const toDb = (item: ReclassificationInput) => ({
  asset_category: item.assetCategory,
  asset_description: item.assetDescription,
  location: item.location,
  unit: item.unit ? parseFloat(item.unit) : null,
  ownership: item.ownership,
  category: item.category,
  remarks: item.remarks,
});

export function ReclassificationProvider({ children }: { children: ReactNode }) {
  const [reclassifications, setReclassifications] = useState<Reclassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReclassification, setEditingReclassification] = useState<Reclassification | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyingReclassification, setVerifyingReclassification] = useState<Reclassification | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const CHUNK = 1000;
      let allRows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('asset_reclassifications')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + CHUNK - 1);
        if (error) { setError(error.message); break; }
        allRows = allRows.concat(data ?? []);
        if (!data || data.length < CHUNK) break;
        from += CHUNK;
      }
      setReclassifications(allRows.map(fromDb));
      setLoading(false);
    };
    fetchAll();
  }, []);

  const addReclassification = async (newItemData: ReclassificationInput, skipLog = false) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('asset_reclassifications')
      .insert({ ...toDb(newItemData), created_by: user?.id ?? null })
      .select()
      .single();

    if (error) { setError(error.message); return; }
    setReclassifications(prev => [fromDb(data), ...prev]);
    if (!skipLog) {
      logActivity({
        actionType: 'ADD_RECLASSIFICATION',
        entityType: 'reclassification',
        entityId: data.id,
        details: { assetDescription: newItemData.assetDescription, category: newItemData.category },
      });
    }
  };

  const updateReclassification = async (id: string, updatedData: ReclassificationInput) => {
    const { data, error } = await supabase
      .from('asset_reclassifications')
      .update({ ...toDb(updatedData), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) { setError(error.message); return; }
    setReclassifications(prev => prev.map(r => r.id === id ? fromDb(data) : r));
    logActivity({
      actionType: 'UPDATE_RECLASSIFICATION',
      entityType: 'reclassification',
      entityId: id,
      details: { assetDescription: updatedData.assetDescription },
    });
  };

  const deleteReclassification = async (id: string) => {
    const target = reclassifications.find(r => r.id === id);
    const { error } = await supabase.from('asset_reclassifications').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setReclassifications(prev => prev.filter(r => r.id !== id));
    logActivity({
      actionType: 'DELETE_RECLASSIFICATION',
      entityType: 'reclassification',
      details: { assetDescription: target?.assetDescription ?? '' },
    });
  };

  const deleteMultipleReclassifications = async (ids: string[]) => {
    const BATCH_SIZE = 100;
    const idSet = new Set(ids);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('asset_reclassifications').delete().in('id', batch);
      if (error) { setError(error.message); return; }
    }
    setReclassifications(prev => prev.filter(r => !idSet.has(r.id)));
    logActivity({ actionType: 'BULK_DELETE', entityType: 'reclassification', details: { count: ids.length } });
  };

  const deleteAllReclassifications = async () => {
    const count = reclassifications.length;
    const { error } = await supabase.from('asset_reclassifications').delete().not('id', 'is', null);
    if (error) { setError(error.message); return; }
    setReclassifications([]);
    logActivity({ actionType: 'BULK_DELETE', entityType: 'reclassification', details: { count } });
  };

  const verifyReclassification = async (id: string, verified: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    const verifiedBy = verified
      ? (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown User')
      : null;

    const { data, error } = await supabase
      .from('asset_reclassifications')
      .update({
        verified,
        verification_date: verified ? new Date().toISOString() : null,
        verified_by: verifiedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) { setError(error.message); return; }
    setReclassifications(prev => prev.map(r => r.id === id ? fromDb(data) : r));
    logActivity({
      actionType: 'VERIFY_RECLASSIFICATION',
      entityType: 'reclassification',
      entityId: id,
      details: { assetDescription: data.asset_description, verified },
    });
  };

  return (
    <ReclassificationContext.Provider value={{
      reclassifications, loading, error,
      addReclassification, updateReclassification, deleteReclassification,
      deleteMultipleReclassifications, deleteAllReclassifications, verifyReclassification,
      isAddModalOpen, setIsAddModalOpen,
      isEditModalOpen, setIsEditModalOpen,
      editingReclassification, setEditingReclassification,
      isVerifyModalOpen, setIsVerifyModalOpen,
      verifyingReclassification, setVerifyingReclassification,
    }}>
      {children}
    </ReclassificationContext.Provider>
  );
}

export function useReclassification() {
  const context = useContext(ReclassificationContext);
  if (context === undefined) {
    throw new Error('useReclassification must be used within a ReclassificationProvider');
  }
  return context;
}

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';

export type ReclassificationCategory = 'Asset' | 'Needs Review' | 'Inventory' | string;

export const RECLASSIFICATION_PRESET_CATEGORIES = ['Asset', 'Needs Review', 'Inventory'] as const;

export type Reclassification = {
  id: string;
  assetId: string | null;
  linkedAssetNumber: string;
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
  'id' | 'assetId' | 'linkedAssetNumber' | 'verified' | 'verificationDate' | 'verifiedBy' | 'createdAt'
>;

interface ReclassificationContextType {
  reclassifications: Reclassification[];
  loading: boolean;
  error: string | null;
  addReclassification: (item: ReclassificationInput, skipLog?: boolean) => Promise<void>;
  addLinkedReclassification: (assetId: string, category: string, remarks: string) => Promise<void>;
  updateReclassification: (id: string, item: ReclassificationInput) => Promise<void>;
  deleteReclassification: (id: string) => Promise<void>;
  deleteMultipleReclassifications: (ids: string[], onProgress?: (processed: number, failed: number) => void) => Promise<void>;
  deleteAllReclassifications: (onProgress?: (processed: number, failed: number) => void) => Promise<void>;
  verifyReclassification: (id: string, verified: boolean) => Promise<void>;
  syncFromAssets: (
    assets: { id: string; verification: boolean }[],
    onProgress?: (processed: number, total: number, failed: number) => void
  ) => Promise<{ total: number; success: number; failed: number }>;
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

const RECLASSIFICATION_SELECT =
  '*, linked_asset:assets(asset_number, asset_description, category_segment1, category_segment2, subsidiary, asset_units)';

// Rows with asset_id set mirror Asset Inventory live (via linked_asset join) so the
// identifying fields never go stale; unlinked rows keep their own free-text columns.
const fromDb = (row: any): Reclassification => {
  const linked = row.linked_asset;
  return {
    id: row.id,
    assetId: row.asset_id ?? null,
    linkedAssetNumber: linked?.asset_number ?? '',
    assetCategory: linked ? (linked.category_segment1 ?? '') : (row.asset_category ?? ''),
    assetDescription: linked ? (linked.asset_description ?? '') : (row.asset_description ?? ''),
    location: linked ? (linked.category_segment2 ?? '') : (row.location ?? ''),
    unit: linked
      ? (linked.asset_units != null ? String(linked.asset_units) : '')
      : (row.unit != null ? String(row.unit) : ''),
    ownership: linked ? (linked.subsidiary ?? '') : (row.ownership ?? ''),
    category: row.category ?? 'Needs Review',
    remarks: row.remarks ?? '',
    // Derived from category, not a stored flag: Needs Review = Unverified,
    // anything else = Verified. Stays consistent with the bidirectional
    // category <-> assets.verification sync (see migration 20260815020000).
    verified: (row.category ?? 'Needs Review') !== 'Needs Review',
    verificationDate: row.verification_date ?? '',
    verifiedBy: row.verified_by ?? '',
    createdAt: row.created_at ?? '',
  };
};

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
          .select(RECLASSIFICATION_SELECT)
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
      .select(RECLASSIFICATION_SELECT)
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

  // "Add Item" now always links to an existing Asset Inventory record (mirrors
  // AddMaintenanceModal's select-asset flow) — identity fields are never typed in,
  // they resolve live via the linked_asset join in fromDb().
  const addLinkedReclassification = async (assetId: string, category: string, remarks: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('asset_reclassifications')
      .insert({ asset_id: assetId, category, remarks, created_by: user?.id ?? null })
      .select(RECLASSIFICATION_SELECT)
      .single();

    if (error) { setError(error.message); throw error; }
    const created = fromDb(data);
    setReclassifications(prev => [created, ...prev]);
    logActivity({
      actionType: 'ADD_RECLASSIFICATION',
      entityType: 'reclassification',
      entityId: data.id,
      details: { assetDescription: created.assetDescription, category },
    });
  };

  const updateReclassification = async (id: string, updatedData: ReclassificationInput) => {
    // Linked rows mirror Asset Inventory live — identity fields aren't stored here,
    // so only the audit-owned fields (classification + remarks) are persisted.
    const isLinked = !!reclassifications.find(r => r.id === id)?.assetId;
    const payload = isLinked
      ? { category: updatedData.category, remarks: updatedData.remarks, updated_at: new Date().toISOString() }
      : { ...toDb(updatedData), updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('asset_reclassifications')
      .update(payload)
      .eq('id', id)
      .select(RECLASSIFICATION_SELECT)
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

  const deleteMultipleReclassifications = async (ids: string[], onProgress?: (processed: number, failed: number) => void) => {
    const BATCH_SIZE = 100;
    let processed = 0;
    let failed = 0;
    let deletedCount = 0;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('asset_reclassifications').delete().in('id', batch);
      if (error) {
        failed += batch.length;
      } else {
        deletedCount += batch.length;
        const batchSet = new Set(batch);
        setReclassifications(prev => prev.filter(r => !batchSet.has(r.id)));
      }
      processed += batch.length;
      onProgress?.(processed, failed);
    }
    if (deletedCount > 0) {
      logActivity({ actionType: 'BULK_DELETE', entityType: 'reclassification', details: { count: deletedCount } });
    }
  };

  const deleteAllReclassifications = async (onProgress?: (processed: number, failed: number) => void) => {
    await deleteMultipleReclassifications(reclassifications.map(r => r.id), onProgress);
  };

  const verifyReclassification = async (id: string, verified: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    const verifiedBy = verified
      ? (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown User')
      : null;

    // Verification is expressed through category now: verifying resolves a
    // pending row to 'Asset', un-verifying sends it back to 'Needs Review'.
    // For linked rows this cascades to assets.verification via the existing
    // category sync trigger.
    const { data, error } = await supabase
      .from('asset_reclassifications')
      .update({
        category: verified ? 'Asset' : 'Needs Review',
        verification_date: verified ? new Date().toISOString() : null,
        verified_by: verifiedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(RECLASSIFICATION_SELECT)
      .single();

    if (error) { setError(error.message); return; }
    const updated = fromDb(data);
    setReclassifications(prev => prev.map(r => r.id === id ? updated : r));
    logActivity({
      actionType: 'VERIFY_RECLASSIFICATION',
      entityType: 'reclassification',
      entityId: id,
      details: { assetDescription: updated.assetDescription, verified },
    });
  };

  const syncFromAssets = async (
    assets: { id: string; verification: boolean }[],
    onProgress?: (processed: number, total: number, failed: number) => void
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const alreadyLinkedIds = new Set(reclassifications.filter(r => r.assetId).map(r => r.assetId));
    const toLink = assets.filter(a => !alreadyLinkedIds.has(a.id));

    const BATCH_SIZE = 10;
    let success = 0;
    let failed = 0;
    for (let i = 0; i < toLink.length; i += BATCH_SIZE) {
      const batch = toLink.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('asset_reclassifications')
        // category mirrors each asset's current verification so linking doesn't
        // silently flip already-unverified assets to verified (see sync triggers).
        .insert(batch.map(a => ({
          asset_id: a.id,
          category: a.verification ? 'Asset' : 'Needs Review',
          created_by: user?.id ?? null,
        })))
        .select(RECLASSIFICATION_SELECT);

      if (error) {
        failed += batch.length;
      } else {
        success += data?.length ?? 0;
        setReclassifications(prev => [...(data ?? []).map(fromDb), ...prev]);
      }
      onProgress?.(Math.min(i + BATCH_SIZE, toLink.length), toLink.length, failed);
    }

    if (success > 0) {
      logActivity({
        actionType: 'SYNC_FROM_ASSETS',
        entityType: 'reclassification',
        details: { total: toLink.length, success, failed },
      });
    }
    return { total: toLink.length, success, failed };
  };

  return (
    <ReclassificationContext.Provider value={{
      reclassifications, loading, error,
      addReclassification, addLinkedReclassification, updateReclassification, deleteReclassification,
      deleteMultipleReclassifications, deleteAllReclassifications, verifyReclassification,
      syncFromAssets,
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

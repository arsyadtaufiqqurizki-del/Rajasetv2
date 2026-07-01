import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type Asset = {
  id: string;
  assetBook: string;
  subsidiary: string;
  assetNumber: string;
  assetDescription: string;
  assetCost: string;
  datePlaceInService: string;
  assetUnits: string;
  categorySegment1: string;
  categorySegment2: string;
  depreciationMethod: string;
  lifeInMonths: string;
  listed: string;
  status: string;
  statusLevel: 'success' | 'warning' | 'error' | 'default';
};

interface AssetContextType {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  subsidiaries: string[];
  categories1: string[];
  categories2: string[];
  addAsset: (asset: Omit<Asset, 'id' | 'statusLevel'>) => Promise<void>;
  updateAsset: (id: string, asset: Omit<Asset, 'id' | 'statusLevel'>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  deleteMultipleAssets: (ids: string[]) => Promise<void>;
  deleteAllAssets: () => Promise<void>;
  addSubsidiary: (name: string) => void;
  deleteSubsidiary: (name: string) => void;
  addCategory1: (name: string) => void;
  deleteCategory1: (name: string) => void;
  addCategory2: (name: string) => void;
  deleteCategory2: (name: string) => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (isOpen: boolean) => void;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (isOpen: boolean) => void;
  editingAsset: Asset | null;
  setEditingAsset: (asset: Asset | null) => void;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

const computeStatusLevel = (status: string): Asset['statusLevel'] => {
  const s = status.toLowerCase();
  if (s === 'active') return 'success';
  if (s.includes('maintenance')) return 'warning';
  if (s.includes('service') || s === 'broken') return 'error';
  return 'default';
};

const fromDb = (row: any): Asset => ({
  id: row.id,
  assetBook: row.asset_book ?? '',
  subsidiary: row.subsidiary ?? '',
  assetNumber: row.asset_number ?? '',
  assetDescription: row.asset_description ?? '',
  assetCost: row.asset_cost != null ? String(row.asset_cost) : '',
  datePlaceInService: row.date_place_in_service ?? '',
  assetUnits: row.asset_units != null ? String(row.asset_units) : '',
  categorySegment1: row.category_segment1 ?? '',
  categorySegment2: row.category_segment2 ?? '',
  depreciationMethod: row.depreciation_method ?? '',
  lifeInMonths: row.life_in_months ?? '',
  listed: row.listed ?? '',
  status: row.status ?? '',
  statusLevel: computeStatusLevel(row.status ?? ''),
});

const toDb = (asset: Omit<Asset, 'id' | 'statusLevel'>) => ({
  asset_book: asset.assetBook,
  subsidiary: asset.subsidiary,
  asset_number: asset.assetNumber,
  asset_description: asset.assetDescription,
  asset_cost: asset.assetCost ? parseFloat(asset.assetCost.replace(/,/g, '')) : null,
  date_place_in_service: asset.datePlaceInService || null,
  asset_units: asset.assetUnits ? parseFloat(asset.assetUnits) : null,
  category_segment1: asset.categorySegment1,
  category_segment2: asset.categorySegment2,
  depreciation_method: asset.depreciationMethod,
  life_in_months: asset.lifeInMonths,
  listed: asset.listed,
  status: asset.status,
});

export function AssetProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<string[]>([]);
  const [categories1, setCategories1] = useState<string[]>([]);
  const [categories2, setCategories2] = useState<string[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [assetsRes, subRes, cat1Res, cat2Res] = await Promise.all([
        supabase.from('assets').select('*').order('created_at', { ascending: false }),
        supabase.from('subsidiaries').select('name').order('name'),
        supabase.from('category_segments_1').select('name').order('name'),
        supabase.from('category_segments_2').select('name').order('name'),
      ]);

      if (assetsRes.error) setError(assetsRes.error.message);
      else setAssets((assetsRes.data ?? []).map(fromDb));

      if (!subRes.error) setSubsidiaries([...new Set((subRes.data ?? []).map(r => r.name))]);
      if (!cat1Res.error) setCategories1([...new Set((cat1Res.data ?? []).map(r => r.name))]);
      if (!cat2Res.error) setCategories2([...new Set((cat2Res.data ?? []).map(r => r.name))]);

      setLoading(false);
    };
    fetchAll();
  }, []);

  const addSubsidiary = (name: string) => {
    if (!name) return;
    setSubsidiaries(prev => prev.includes(name) ? prev : [...prev, name]);
    supabase.from('subsidiaries').upsert({ name }, { onConflict: 'name' }).then();
  };
  const deleteSubsidiary = (name: string) => {
    setSubsidiaries(prev => prev.filter(s => s !== name));
    supabase.from('subsidiaries').delete().eq('name', name).then();
  };

  const addCategory1 = (name: string) => {
    if (!name) return;
    setCategories1(prev => prev.includes(name) ? prev : [...prev, name]);
    supabase.from('category_segments_1').upsert({ name }, { onConflict: 'name' }).then();
  };
  const deleteCategory1 = (name: string) => {
    setCategories1(prev => prev.filter(c => c !== name));
    supabase.from('category_segments_1').delete().eq('name', name).then();
  };

  const addCategory2 = (name: string) => {
    if (!name) return;
    setCategories2(prev => prev.includes(name) ? prev : [...prev, name]);
    supabase.from('category_segments_2').upsert({ name }, { onConflict: 'name' }).then();
  };
  const deleteCategory2 = (name: string) => {
    setCategories2(prev => prev.filter(c => c !== name));
    supabase.from('category_segments_2').delete().eq('name', name).then();
  };

  const addAsset = async (newAssetData: Omit<Asset, 'id' | 'statusLevel'>) => {
    if (newAssetData.subsidiary) addSubsidiary(newAssetData.subsidiary);
    if (newAssetData.categorySegment1) addCategory1(newAssetData.categorySegment1);
    if (newAssetData.categorySegment2) addCategory2(newAssetData.categorySegment2);

    const { data, error } = await supabase
      .from('assets')
      .insert(toDb(newAssetData))
      .select()
      .single();

    if (error) { setError(error.message); return; }
    setAssets(prev => [fromDb(data), ...prev]);
  };

  const updateAsset = async (id: string, updatedData: Omit<Asset, 'id' | 'statusLevel'>) => {
    if (updatedData.subsidiary) addSubsidiary(updatedData.subsidiary);
    if (updatedData.categorySegment1) addCategory1(updatedData.categorySegment1);
    if (updatedData.categorySegment2) addCategory2(updatedData.categorySegment2);

    const { data, error } = await supabase
      .from('assets')
      .update(toDb(updatedData))
      .eq('id', id)
      .select()
      .single();

    if (error) { setError(error.message); return; }
    setAssets(prev => prev.map(a => a.id === id ? fromDb(data) : a));
  };

  const deleteAsset = async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const deleteMultipleAssets = async (ids: string[]) => {
    const BATCH_SIZE = 100;
    const idSet = new Set(ids);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('assets').delete().in('id', batch);
      if (error) { setError(error.message); return; }
    }
    setAssets(prev => prev.filter(a => !idSet.has(a.id)));
  };

  const deleteAllAssets = async () => {
    const { error } = await supabase.from('assets').delete().not('id', 'is', null);
    if (error) { setError(error.message); return; }
    setAssets([]);
  };

  return (
    <AssetContext.Provider value={{
      assets, loading, error,
      subsidiaries, categories1, categories2,
      addAsset, updateAsset, deleteAsset, deleteMultipleAssets, deleteAllAssets,
      addSubsidiary, deleteSubsidiary, addCategory1, deleteCategory1, addCategory2, deleteCategory2,
      isAddModalOpen, setIsAddModalOpen,
      isEditModalOpen, setIsEditModalOpen,
      editingAsset, setEditingAsset
    }}>
      {children}
    </AssetContext.Provider>
  );
}

export function useAsset() {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAsset must be used within an AssetProvider');
  }
  return context;
}

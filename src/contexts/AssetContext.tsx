import React, { createContext, useState, useContext, ReactNode } from 'react';

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
  subsidiaries: string[];
  categories1: string[];
  categories2: string[];
  addAsset: (asset: Omit<Asset, 'id' | 'statusLevel'>) => void;
  updateAsset: (id: string, asset: Omit<Asset, 'id' | 'statusLevel'>) => void;
  deleteAsset: (id: string) => void;
  deleteMultipleAssets: (ids: string[]) => void;
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

export function AssetProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<string[]>(['PT Raja Prima', 'Tech Solutions']);
  const [categories1, setCategories1] = useState<string[]>(['Vehicles', 'Buildings', 'Electronics']);
  const [categories2, setCategories2] = useState<string[]>(['Location', 'Department']);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const addSubsidiary = (name: string) => {
    if (name && !subsidiaries.includes(name)) setSubsidiaries(prev => [...prev, name]);
  };
  const deleteSubsidiary = (name: string) => setSubsidiaries(prev => prev.filter(s => s !== name));

  const addCategory1 = (name: string) => {
    if (name && !categories1.includes(name)) setCategories1(prev => [...prev, name]);
  };
  const deleteCategory1 = (name: string) => setCategories1(prev => prev.filter(c => c !== name));

  const addCategory2 = (name: string) => {
    if (name && !categories2.includes(name)) setCategories2(prev => [...prev, name]);
  };
  const deleteCategory2 = (name: string) => setCategories2(prev => prev.filter(c => c !== name));

  const addAsset = (newAssetData: Omit<Asset, 'id' | 'statusLevel'>) => {
    if (newAssetData.subsidiary) addSubsidiary(newAssetData.subsidiary);
    if (newAssetData.categorySegment1) addCategory1(newAssetData.categorySegment1);
    if (newAssetData.categorySegment2) addCategory2(newAssetData.categorySegment2);

    const newAsset: Asset = {
      ...newAssetData,
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      statusLevel: newAssetData.status.toLowerCase() === 'active' ? 'success' : 
                   newAssetData.status.toLowerCase().includes('maintenance') ? 'warning' :
                   (newAssetData.status.toLowerCase().includes('service') || newAssetData.status.toLowerCase() === 'broken') ? 'error' : 'default'
    };
    setAssets(prev => [...prev, newAsset]);
  };

  const updateAsset = (id: string, updatedAssetData: Omit<Asset, 'id' | 'statusLevel'>) => {
    if (updatedAssetData.subsidiary) addSubsidiary(updatedAssetData.subsidiary);
    if (updatedAssetData.categorySegment1) addCategory1(updatedAssetData.categorySegment1);
    if (updatedAssetData.categorySegment2) addCategory2(updatedAssetData.categorySegment2);

    setAssets(prev => prev.map(asset => {
      if (asset.id === id) {
        return {
          ...updatedAssetData,
          id,
          statusLevel: updatedAssetData.status.toLowerCase() === 'active' ? 'success' : 
                       updatedAssetData.status.toLowerCase().includes('maintenance') ? 'warning' :
                       (updatedAssetData.status.toLowerCase().includes('service') || updatedAssetData.status.toLowerCase() === 'broken') ? 'error' : 'default'
        };
      }
      return asset;
    }));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== id));
  };

  const deleteMultipleAssets = (ids: string[]) => {
    setAssets(prev => prev.filter(asset => !ids.includes(asset.id)));
  };

  return (
    <AssetContext.Provider value={{ 
      assets, subsidiaries, categories1, categories2,
      addAsset, updateAsset, deleteAsset, deleteMultipleAssets,
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

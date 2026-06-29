import React, { createContext, useState, useContext, ReactNode } from 'react';

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
  addRecord: (record: Omit<MaintenanceRecord, 'id'>) => void;
  updateRecord: (id: string, record: Omit<MaintenanceRecord, 'id'>) => void;
  deleteRecord: (id: string) => void;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);

  const addRecord = (record: Omit<MaintenanceRecord, 'id'>) => {
    const newRecord = { ...record, id: Math.random().toString(36).substring(2, 9).toUpperCase() };
    setRecords(prev => [...prev, newRecord]);
  };

  const updateRecord = (id: string, updated: Omit<MaintenanceRecord, 'id'>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...updated, id } : r));
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  return (
    <MaintenanceContext.Provider value={{ records, addRecord, updateRecord, deleteRecord }}>
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

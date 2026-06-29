import React, { useState } from 'react';
import { useAsset } from '../contexts/AssetContext';
import { Plus, Trash2 } from 'lucide-react';

export default function MasterData() {
  const { 
    subsidiaries, addSubsidiary, deleteSubsidiary,
    categories1, addCategory1, deleteCategory1,
    categories2, addCategory2, deleteCategory2
  } = useAsset();

  const [newSub, setNewSub] = useState('');
  const [newCat1, setNewCat1] = useState('');
  const [newCat2, setNewCat2] = useState('');

  const handleAddSub = (e: React.FormEvent) => {
    e.preventDefault();
    addSubsidiary(newSub);
    setNewSub('');
  };

  const handleAddCat1 = (e: React.FormEvent) => {
    e.preventDefault();
    addCategory1(newCat1);
    setNewCat1('');
  };

  const handleAddCat2 = (e: React.FormEvent) => {
    e.preventDefault();
    addCategory2(newCat2);
    setNewCat2('');
  };

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-[180px])] min-h-[600px] overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Master Data</h1>
        <p className="text-on-surface-variant mt-1 text-sm">Manage system-wide data entities like Subsidiaries and Categories.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subsidiaries */}
        <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <h2 className="text-lg font-medium text-on-surface">Subsidiaries</h2>
          </div>
          <div className="p-4 border-b border-outline-variant">
            <form onSubmit={handleAddSub} className="flex gap-2">
              <input 
                type="text" 
                value={newSub}
                onChange={e => setNewSub(e.target.value)}
                placeholder="New subsidiary..."
                className="flex-1 bg-surface border border-outline-variant rounded-md text-sm py-2 px-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button type="submit" disabled={!newSub.trim()} className="bg-primary text-on-primary p-2 rounded-md hover:bg-primary/90 disabled:opacity-50">
                <Plus className="h-5 w-5" />
              </button>
            </form>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col gap-1">
              {subsidiaries.map(sub => (
                <li key={sub} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container-low group">
                  <span className="text-sm text-on-surface">{sub}</span>
                  <button onClick={() => deleteSubsidiary(sub)} className="text-error opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {subsidiaries.length === 0 && (
                <li className="text-sm text-on-surface-variant text-center p-4">No subsidiaries configured</li>
              )}
            </ul>
          </div>
        </div>

        {/* Categories 1 */}
        <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <h2 className="text-lg font-medium text-on-surface">Category Segment 1</h2>
          </div>
          <div className="p-4 border-b border-outline-variant">
            <form onSubmit={handleAddCat1} className="flex gap-2">
              <input 
                type="text" 
                value={newCat1}
                onChange={e => setNewCat1(e.target.value)}
                placeholder="New category 1..."
                className="flex-1 bg-surface border border-outline-variant rounded-md text-sm py-2 px-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button type="submit" disabled={!newCat1.trim()} className="bg-primary text-on-primary p-2 rounded-md hover:bg-primary/90 disabled:opacity-50">
                <Plus className="h-5 w-5" />
              </button>
            </form>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col gap-1">
              {categories1.map(cat => (
                <li key={cat} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container-low group">
                  <span className="text-sm text-on-surface">{cat}</span>
                  <button onClick={() => deleteCategory1(cat)} className="text-error opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {categories1.length === 0 && (
                <li className="text-sm text-on-surface-variant text-center p-4">No categories configured</li>
              )}
            </ul>
          </div>
        </div>

        {/* Categories 2 */}
        <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <h2 className="text-lg font-medium text-on-surface">Category Segment 2</h2>
          </div>
          <div className="p-4 border-b border-outline-variant">
            <form onSubmit={handleAddCat2} className="flex gap-2">
              <input 
                type="text" 
                value={newCat2}
                onChange={e => setNewCat2(e.target.value)}
                placeholder="New category 2..."
                className="flex-1 bg-surface border border-outline-variant rounded-md text-sm py-2 px-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button type="submit" disabled={!newCat2.trim()} className="bg-primary text-on-primary p-2 rounded-md hover:bg-primary/90 disabled:opacity-50">
                <Plus className="h-5 w-5" />
              </button>
            </form>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col gap-1">
              {categories2.map(cat => (
                <li key={cat} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container-low group">
                  <span className="text-sm text-on-surface">{cat}</span>
                  <button onClick={() => deleteCategory2(cat)} className="text-error opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {categories2.length === 0 && (
                <li className="text-sm text-on-surface-variant text-center p-4">No categories configured</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

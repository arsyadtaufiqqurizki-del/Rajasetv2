import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface MasterDataPanelProps {
  title: string;
  items: string[];
  onAdd: (name: string) => void;
  onDelete: (name: string) => void;
  placeholder: string;
  emptyMessage: string;
}

export default function MasterDataPanel({ title, items, onAdd, onDelete, placeholder, emptyMessage }: MasterDataPanelProps) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    onAdd(newItem.trim());
    setNewItem('');
  };

  return (
    <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="p-4 border-b border-outline-variant bg-surface-container-low">
        <h2 className="text-lg font-medium text-on-surface">{title}</h2>
      </div>
      <div className="p-4 border-b border-outline-variant">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-surface border border-outline-variant rounded-md text-sm py-2 px-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button type="submit" disabled={!newItem.trim()} className="bg-primary text-on-primary p-2 rounded-md hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-5 w-5" />
          </button>
        </form>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {items.map(item => (
            <li key={item} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container-low group">
              <span className="text-sm text-on-surface">{item}</span>
              <button onClick={() => onDelete(item)} className="text-error opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-sm text-on-surface-variant text-center p-4">{emptyMessage}</li>
          )}
        </ul>
      </div>
    </div>
  );
}

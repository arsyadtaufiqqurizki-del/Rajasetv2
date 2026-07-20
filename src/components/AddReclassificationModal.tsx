import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useReclassification, RECLASSIFICATION_PRESET_CATEGORIES } from '../contexts/ReclassificationContext';
import AutocompleteInput from './AutocompleteInput';

const EMPTY_FORM = {
  assetCategory: '',
  assetDescription: '',
  location: '',
  unit: '1',
  ownership: '',
};

export default function AddReclassificationModal() {
  const { isAddModalOpen, setIsAddModalOpen, addReclassification, reclassifications } = useReclassification();

  const assetCategories = useMemo(
    () => Array.from(new Set(reclassifications.map(r => r.assetCategory).filter(Boolean))),
    [reclassifications]
  );

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [categorySelect, setCategorySelect] = useState<string>(RECLASSIFICATION_PRESET_CATEGORIES[1]);
  const [customCategory, setCustomCategory] = useState('');

  if (!isAddModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = categorySelect === 'Custom' ? customCategory.trim() : categorySelect;
    if (!category) return;

    await addReclassification({ ...formData, category });
    setIsAddModalOpen(false);
    setFormData(EMPTY_FORM);
    setCategorySelect(RECLASSIFICATION_PRESET_CATEGORIES[1]);
    setCustomCategory('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 className="text-xl font-bold text-on-surface">Tambah Item Reclassification</h2>
          <button
            onClick={() => setIsAddModalOpen(false)}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-on-surface">Asset Description *</label>
              <input
                required
                name="assetDescription"
                value={formData.assetDescription}
                onChange={handleChange}
                placeholder="e.g. Kompresor GA-30 ditemukan di Gudang A"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Asset Category</label>
              <AutocompleteInput
                name="assetCategory"
                value={formData.assetCategory}
                onChange={handleChange as any}
                placeholder="e.g. Elektronik"
                options={assetCategories}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Location</label>
              <input
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Gudang A"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Unit</label>
              <input
                type="number"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Ownership</label>
              <input
                name="ownership"
                value={formData.ownership}
                onChange={handleChange}
                placeholder="e.g. Divisi Operasional"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Category (Klasifikasi) *</label>
              <select
                value={categorySelect}
                onChange={(e) => setCategorySelect(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {RECLASSIFICATION_PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="Custom">Custom...</option>
              </select>
            </div>
            {categorySelect === 'Custom' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-on-surface">Nama Custom *</label>
                <input
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Barang Hilang"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

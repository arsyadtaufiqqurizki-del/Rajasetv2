import React, { useEffect, useState } from 'react';
import { X, Link2 } from 'lucide-react';
import { useReclassification, RECLASSIFICATION_PRESET_CATEGORIES } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import AutocompleteInput from './ui/AutocompleteInput';

const EMPTY_FORM = {
  assetCategory: '',
  assetDescription: '',
  location: '',
  unit: '1',
  ownership: '',
  remarks: '',
};

export default function EditReclassificationModal() {
  const {
    isEditModalOpen, setIsEditModalOpen,
    editingReclassification, setEditingReclassification,
    updateReclassification,
  } = useReclassification();

  const { categories1, categories2, subsidiaries } = useAsset();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [categorySelect, setCategorySelect] = useState<string>(RECLASSIFICATION_PRESET_CATEGORIES[1]);
  const [customCategory, setCustomCategory] = useState('');

  useEffect(() => {
    if (editingReclassification) {
      setFormData({
        assetCategory: editingReclassification.assetCategory,
        assetDescription: editingReclassification.assetDescription,
        location: editingReclassification.location,
        unit: editingReclassification.unit,
        ownership: editingReclassification.ownership,
        remarks: editingReclassification.remarks,
      });
      const isPreset = (RECLASSIFICATION_PRESET_CATEGORIES as readonly string[]).includes(editingReclassification.category);
      setCategorySelect(isPreset ? editingReclassification.category : 'Custom');
      setCustomCategory(isPreset ? '' : editingReclassification.category);
    }
  }, [editingReclassification]);

  if (!isEditModalOpen || !editingReclassification) return null;

  const isLinked = !!editingReclassification.assetId;

  const handleClose = () => {
    setIsEditModalOpen(false);
    setEditingReclassification(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = categorySelect === 'Custom' ? customCategory.trim() : categorySelect;
    if (!category) return;

    await updateReclassification(editingReclassification.id, { ...formData, category });
    handleClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 className="text-xl font-bold text-on-surface">Edit Item Reclassification</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {isLinked && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-on-surface-variant">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              Item ini tertaut ke Asset Inventory{editingReclassification.linkedAssetNumber ? ` (#${editingReclassification.linkedAssetNumber})` : ''}.
              Deskripsi/kategori/lokasi/unit/ownership mengikuti data Inventory secara live — edit lewat halaman Inventory. Hanya klasifikasi audit &amp; remarks yang bisa diubah di sini.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-on-surface">Asset Description *</label>
              <input
                required
                disabled={isLinked}
                name="assetDescription"
                value={formData.assetDescription}
                onChange={handleChange}
                placeholder="e.g. Kompresor GA-30 ditemukan di Gudang A"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Asset Category</label>
              {isLinked ? (
                <input
                  disabled
                  value={formData.assetCategory}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm opacity-60 cursor-not-allowed"
                />
              ) : (
                <AutocompleteInput
                  name="assetCategory"
                  value={formData.assetCategory}
                  onChange={handleChange as any}
                  placeholder="e.g. Elektronik"
                  options={categories1}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Location</label>
              {isLinked ? (
                <input
                  disabled
                  value={formData.location}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm opacity-60 cursor-not-allowed"
                />
              ) : (
                <AutocompleteInput
                  name="location"
                  value={formData.location}
                  onChange={handleChange as any}
                  placeholder="e.g. Gudang A"
                  options={categories2}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Unit</label>
              <input
                type="number"
                disabled={isLinked}
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                min="0"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Ownership</label>
              {isLinked ? (
                <input
                  disabled
                  value={formData.ownership}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm opacity-60 cursor-not-allowed"
                />
              ) : (
                <AutocompleteInput
                  name="ownership"
                  value={formData.ownership}
                  onChange={handleChange as any}
                  placeholder="e.g. Divisi Operasional"
                  options={subsidiaries}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Item Status (Klasifikasi) *</label>
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

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-on-surface">Remarks</label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange as any}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

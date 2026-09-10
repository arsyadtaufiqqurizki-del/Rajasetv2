import React from 'react';
import { X, Link2, Loader2 } from 'lucide-react';
import { useReclassification, RECLASSIFICATION_PRESET_CATEGORIES } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import AutocompleteInput from './ui/AutocompleteInput';
import { useEntityForm } from '../hooks/useEntityForm';
import {
  CUSTOM_CATEGORY,
  EMPTY_EDIT_RECLASSIFICATION_FORM,
  reclassificationToFormValues,
  resolveCategory,
  toReclassificationPayload,
} from '../lib/reclassificationForm';

const FIELD_CLASS =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
const LOCKED_FIELD_CLASS =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm opacity-60 cursor-not-allowed';
const DISABLABLE_FIELD_CLASS = `${FIELD_CLASS} disabled:opacity-60 disabled:cursor-not-allowed`;

export default function EditReclassificationModal() {
  const {
    isEditModalOpen, setIsEditModalOpen,
    editingReclassification, setEditingReclassification,
    updateReclassification,
  } = useReclassification();

  const { categories1, categories2, subsidiaries } = useAsset();

  const form = useEntityForm({
    // Only reached when the modal is opened without a row; the early return below
    // means the blank form is never rendered.
    initialValues: EMPTY_EDIT_RECLASSIFICATION_FORM,
    resetKey: editingReclassification,
    seed: () => (editingReclassification ? reclassificationToFormValues(editingReclassification) : null),
    errorPrefix: 'Gagal memperbarui item',
  });

  if (!isEditModalOpen || !editingReclassification) return null;

  const isLinked = !!editingReclassification.assetId;
  const { categorySelect, customCategory } = form.values;
  const category = resolveCategory(categorySelect, customCategory);

  const handleClose = () => {
    setIsEditModalOpen(false);
    setEditingReclassification(null);
  };

  // The blank-custom-category guard sits outside form.handleSubmit so it never
  // raises isSaving — it has always been a plain no-op.
  const handleSubmit = (e: React.FormEvent) => {
    if (!category) {
      e.preventDefault();
      return;
    }
    void form.handleSubmit(async values => {
      const minDelay = new Promise(resolve => setTimeout(resolve, 600));
      await Promise.all([
        updateReclassification(editingReclassification.id, toReclassificationPayload(values, category)),
        minDelay,
      ]);
      handleClose();
    })(e);
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
                value={form.values.assetDescription}
                onChange={form.handleChange}
                placeholder="e.g. Kompresor GA-30 ditemukan di Gudang A"
                className={DISABLABLE_FIELD_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Asset Category</label>
              {isLinked ? (
                <input disabled value={form.values.assetCategory} className={LOCKED_FIELD_CLASS} />
              ) : (
                <AutocompleteInput
                  name="assetCategory"
                  value={form.values.assetCategory}
                  onChange={form.handleChange}
                  placeholder="e.g. Elektronik"
                  options={categories1}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Location</label>
              {isLinked ? (
                <input disabled value={form.values.location} className={LOCKED_FIELD_CLASS} />
              ) : (
                <AutocompleteInput
                  name="location"
                  value={form.values.location}
                  onChange={form.handleChange}
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
                value={form.values.unit}
                onChange={form.handleChange}
                min="0"
                className={DISABLABLE_FIELD_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Ownership</label>
              {isLinked ? (
                <input disabled value={form.values.ownership} className={LOCKED_FIELD_CLASS} />
              ) : (
                <AutocompleteInput
                  name="ownership"
                  value={form.values.ownership}
                  onChange={form.handleChange}
                  placeholder="e.g. Divisi Operasional"
                  options={subsidiaries}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Item Status (Klasifikasi) *</label>
              <select
                name="categorySelect"
                value={categorySelect}
                onChange={form.handleChange}
                className={`${FIELD_CLASS} cursor-pointer`}
              >
                {RECLASSIFICATION_PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value={CUSTOM_CATEGORY}>Custom...</option>
              </select>
            </div>
            {categorySelect === CUSTOM_CATEGORY && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-on-surface">Nama Custom *</label>
                <input
                  required
                  name="customCategory"
                  value={customCategory}
                  onChange={form.handleChange}
                  placeholder="e.g. Barang Hilang"
                  className={FIELD_CLASS}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-on-surface">Remarks</label>
              <textarea
                name="remarks"
                value={form.values.remarks}
                onChange={form.handleChange}
                placeholder="Catatan tambahan (opsional)"
                rows={3}
                className={`${FIELD_CLASS} resize-none`}
              />
            </div>
          </div>

          {form.saveError && (
            <p className="text-sm text-error bg-error-container/20 border border-error/20 rounded-lg px-3 py-2">
              {form.saveError}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={form.isSaving}
              className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.isSaving}
              className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
            >
              {form.isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

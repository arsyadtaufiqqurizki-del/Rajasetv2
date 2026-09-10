import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { useReclassification, RECLASSIFICATION_PRESET_CATEGORIES } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import AssetPicker from './ui/AssetPicker';
import { useEntityForm } from '../hooks/useEntityForm';
import {
  CUSTOM_CATEGORY,
  EMPTY_ADD_RECLASSIFICATION_FORM,
  resolveCategory,
} from '../lib/reclassificationForm';

const PICKER_TRIGGER_CLASS =
  'w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-primary';
const PICKER_PANEL_CLASS =
  'absolute z-50 mt-1 w-full bg-surface border border-outline-variant rounded-lg shadow-lg';
const FIELD_CLASS =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export default function AddReclassificationModal() {
  const { isAddModalOpen, setIsAddModalOpen, addLinkedReclassification, reclassifications } = useReclassification();
  const { assets } = useAsset();

  const form = useEntityForm({
    initialValues: EMPTY_ADD_RECLASSIFICATION_FORM,
    resetKey: isAddModalOpen,
    seed: () => EMPTY_ADD_RECLASSIFICATION_FORM,
    errorPrefix: 'Gagal menyimpan item',
  });

  // An asset already linked to a reclassification row shouldn't be pickable again
  // here — that's what "Sync from Assets" is for in bulk; one audit row per asset.
  const alreadyLinkedIds = React.useMemo(
    () => new Set(reclassifications.filter(r => r.assetId).map(r => r.assetId)),
    [reclassifications]
  );
  const linkableAssets = React.useMemo(
    () => assets.filter(a => !alreadyLinkedIds.has(a.id)),
    [assets, alreadyLinkedIds]
  );

  if (!isAddModalOpen) return null;

  const { assetId, categorySelect, customCategory } = form.values;
  const selectedAsset = assets.find(a => a.id === assetId);
  const category = resolveCategory(categorySelect, customCategory);

  const handleClose = () => setIsAddModalOpen(false);

  // Both guards sit outside form.handleSubmit so an incomplete submit never raises
  // isSaving — that has always been a plain no-op.
  const handleSubmit = (e: React.FormEvent) => {
    if (!assetId || !category) {
      e.preventDefault();
      return;
    }
    void form.handleSubmit(async values => {
      const minDelay = new Promise(resolve => setTimeout(resolve, 600));
      await Promise.all([addLinkedReclassification(assetId, category, values.remarks), minDelay]);
      setIsAddModalOpen(false);
    })(e);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 className="text-xl font-bold text-on-surface">Tambah Item Reclassification</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-on-surface">Select Asset *</label>
            <AssetPicker
              assets={linkableAssets}
              value={assetId}
              onChange={picked => form.setValues(prev => ({ ...prev, assetId: picked }))}
              placeholder="Pilih asset dari Inventory"
              triggerClassName={PICKER_TRIGGER_CLASS}
              panelClassName={PICKER_PANEL_CLASS}
              renderMoreHint={total => `Menampilkan 50 dari ${total} asset. Ketik untuk mencari.`}
            />
          </div>

          {selectedAsset && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant text-sm">
              <div><span className="text-on-surface-variant">Asset Class:</span> {selectedAsset.categorySegment1 || '-'}</div>
              <div><span className="text-on-surface-variant">Location:</span> {selectedAsset.categorySegment2 || '-'}</div>
              <div><span className="text-on-surface-variant">Ownership:</span> {selectedAsset.subsidiary || '-'}</div>
              <div><span className="text-on-surface-variant">Unit:</span> {selectedAsset.assetUnits || '-'}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
              disabled={form.isSaving || !assetId}
              className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
            >
              {form.isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Simpan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

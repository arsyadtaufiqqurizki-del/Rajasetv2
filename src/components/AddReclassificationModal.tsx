import React from 'react';
import { useReclassification, RECLASSIFICATION_PRESET_CATEGORIES } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import AssetPicker from './ui/AssetPicker';
import FormModal from './ui/FormModal';
import { useEntityForm } from '../hooks/useEntityForm';
import { en as copy } from '../i18n/en';
import {
  CUSTOM_CATEGORY,
  EMPTY_ADD_RECLASSIFICATION_FORM,
  resolveCategory,
} from '../lib/reclassificationForm';

const TITLE_ID = 'add-reclassification-modal-title';

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
    errorPrefix: copy.reclassification.addModal.saveErrorPrefix,
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
    <FormModal
      isOpen={isAddModalOpen}
      titleId={TITLE_ID}
      title={copy.reclassification.addModal.title}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="Simpan"
      isSaving={form.isSaving}
      submitDisabled={!assetId}
      error={form.saveError}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-on-surface">Select Asset *</label>
        <AssetPicker
          assets={linkableAssets}
          value={assetId}
          onChange={picked => form.setValues(prev => ({ ...prev, assetId: picked }))}
          placeholder={copy.reclassification.addModal.selectAssetPlaceholder}
          triggerClassName={PICKER_TRIGGER_CLASS}
          panelClassName={PICKER_PANEL_CLASS}
          renderMoreHint={copy.assetPicker.moreHint}
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
            <label className="text-sm font-semibold text-on-surface">{copy.reclassification.form.customNameLabel}</label>
            <input
              required
              name="customCategory"
              value={customCategory}
              onChange={form.handleChange}
              placeholder={copy.reclassification.form.customPlaceholder}
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
            placeholder={copy.reclassification.form.remarksPlaceholder}
            rows={3}
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>
      </div>
    </FormModal>
  );
}

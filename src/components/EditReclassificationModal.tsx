import React from 'react';
import { Link2 } from 'lucide-react';
import { useReclassification, RECLASSIFICATION_PRESET_CATEGORIES } from '../contexts/ReclassificationContext';
import { useAsset } from '../contexts/AssetContext';
import AutocompleteInput from './ui/AutocompleteInput';
import FormModal from './ui/FormModal';
import { useEntityForm } from '../hooks/useEntityForm';
import { en as copy } from '../i18n/en';
import {
  CUSTOM_CATEGORY,
  EMPTY_EDIT_RECLASSIFICATION_FORM,
  reclassificationToFormValues,
  resolveCategory,
  toReclassificationPayload,
} from '../lib/reclassificationForm';

const TITLE_ID = 'edit-reclassification-modal-title';

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
    errorPrefix: copy.reclassification.editModal.saveErrorPrefix,
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
    <FormModal
      isOpen={isEditModalOpen}
      titleId={TITLE_ID}
      title="Edit Item Reclassification"
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="Update"
      savingLabel="Updating..."
      isSaving={form.isSaving}
      error={form.saveError}
    >
      {isLinked && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-on-surface-variant">
          <Link2 className="h-4 w-4 text-primary shrink-0" />
          {copy.reclassification.editModal.linkedBanner(editingReclassification.linkedAssetNumber ?? '')}
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
            placeholder={copy.reclassification.form.descriptionPlaceholder}
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
              placeholder={copy.reclassification.form.categoryPlaceholder}
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
              placeholder={copy.reclassification.form.locationPlaceholder}
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
              placeholder={copy.reclassification.form.ownershipPlaceholder}
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

import React from 'react';
import { useAsset } from '../contexts/AssetContext';
import { useMaintenance } from '../contexts/MaintenanceContext';
import AssetPicker from './ui/AssetPicker';
import FormModal from './ui/FormModal';
import { useEntityForm } from '../hooks/useEntityForm';
import { emptyAddMaintenanceForm, toMaintenancePayload } from '../lib/maintenanceForm';
import { en as copy } from '../i18n/en';

interface AddMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TITLE_ID = 'add-maintenance-modal-title';

const PICKER_TRIGGER_CLASS =
  'w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary';
const PICKER_PANEL_CLASS =
  'absolute z-50 mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg';
const INPUT_CLASS =
  'w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

export default function AddMaintenanceModal({ isOpen, onClose }: AddMaintenanceModalProps) {
  const { assets } = useAsset();
  const { addRecord } = useMaintenance();

  const form = useEntityForm({
    initialValues: emptyAddMaintenanceForm(),
    // Opening or closing blanks the whole form, picked asset included — that is what
    // the old reset-on-close effect did, except the scheduled date is now taken at
    // open time rather than at close time.
    resetKey: isOpen,
    seed: emptyAddMaintenanceForm,
    errorPrefix: 'Failed to save maintenance record',
  });

  if (!isOpen) return null;

  const selectedAsset = assets.find(a => a.id === form.values.assetId);

  // The guard sits outside form.handleSubmit so a submit with no asset picked never
  // raises isSaving — pressing Save with an empty picker has always been a no-op.
  const handleSubmit = (e: React.FormEvent) => {
    if (!selectedAsset) {
      e.preventDefault();
      return;
    }
    void form.handleSubmit(async values => {
      const minDelay = new Promise(resolve => setTimeout(resolve, 600));
      await Promise.all([addRecord(toMaintenancePayload(selectedAsset, values)), minDelay]);
      onClose();
    })(e);
  };

  return (
    <FormModal
      isOpen={isOpen}
      titleId={TITLE_ID}
      title="Add Maintenance Record"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save Record"
      isSaving={form.isSaving}
      error={form.saveError}
    >
      <div>
        <label className="block text-sm font-medium text-on-surface mb-2">Select Asset *</label>
        <AssetPicker
          assets={assets}
          value={form.values.assetId}
          onChange={assetId => form.setValues(prev => ({ ...prev, assetId }))}
          placeholder="Select an asset"
          triggerClassName={PICKER_TRIGGER_CLASS}
          panelClassName={PICKER_PANEL_CLASS}
          renderMoreHint={copy.assetPicker.moreHint}
        />
      </div>

      {selectedAsset && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant text-sm">
          <div><span className="text-on-surface-variant">Book:</span> {selectedAsset.assetBook || selectedAsset.id}</div>
          <div><span className="text-on-surface-variant">Subsidiary:</span> {selectedAsset.subsidiary}</div>
          <div><span className="text-on-surface-variant">Asset Class:</span> {selectedAsset.categorySegment1}</div>
          <div><span className="text-on-surface-variant">Location:</span> {selectedAsset.categorySegment2}</div>
          <div><span className="text-on-surface-variant">Units:</span> {selectedAsset.assetUnits}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Scheduled Date *</label>
          <input
            required
            type="date"
            name="scheduledDate"
            value={form.values.scheduledDate}
            onChange={form.handleChange}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Service Type *</label>
          <input
            required
            type="text"
            name="serviceType"
            value={form.values.serviceType}
            onChange={form.handleChange}
            className={INPUT_CLASS}
            placeholder="e.g. Oil Change, Repair"
          />
        </div>
        <div className="md:col-span-2">
          <span className="block text-sm font-medium text-on-surface mb-2">Status *</span>
          <div
            role="radiogroup"
            aria-label="Status"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5"
          >
            {['Pending', 'In Progress', 'Completed', 'Overdue'].map(option => (
              <label key={option} className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={option}
                  checked={form.values.status === option}
                  onChange={form.handleChange}
                  required
                  className="h-4 w-4 border-outline-variant text-primary focus:ring-primary"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Estimate Cost</label>
          <input
            type="text"
            name="estimateCost"
            value={form.values.estimateCost}
            onChange={form.handleChange}
            className={INPUT_CLASS}
            placeholder="e.g. $500.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Actual Cost</label>
          <input
            type="text"
            name="actualCost"
            value={form.values.actualCost}
            onChange={form.handleChange}
            className={INPUT_CLASS}
            placeholder="e.g. $450.00"
          />
        </div>
      </div>
    </FormModal>
  );
}

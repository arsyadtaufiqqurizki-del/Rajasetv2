import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAsset } from '../contexts/AssetContext';
import { useMaintenance } from '../contexts/MaintenanceContext';
import AssetPicker from './ui/AssetPicker';
import { useEntityForm } from '../hooks/useEntityForm';
import { emptyAddMaintenanceForm, toMaintenancePayload } from '../lib/maintenanceForm';

interface AddMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <h2 className="text-xl font-bold text-on-surface">Add Maintenance Record</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
            <X className="h-5 w-5 text-on-surface-variant" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Select Asset *</label>
            <AssetPicker
              assets={assets}
              value={form.values.assetId}
              onChange={assetId => form.setValues(prev => ({ ...prev, assetId }))}
              placeholder="Select an asset"
              triggerClassName={PICKER_TRIGGER_CLASS}
              panelClassName={PICKER_PANEL_CLASS}
              renderMoreHint={total => `Menampilkan 50 dari ${total} aset. Ketik untuk mencari.`}
            />
          </div>

          {selectedAsset && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant text-sm">
              <div><span className="text-on-surface-variant">Book:</span> {selectedAsset.assetBook || selectedAsset.id}</div>
              <div><span className="text-on-surface-variant">Subsidiary:</span> {selectedAsset.subsidiary}</div>
              <div><span className="text-on-surface-variant">Category 1:</span> {selectedAsset.categorySegment1}</div>
              <div><span className="text-on-surface-variant">Category 2:</span> {selectedAsset.categorySegment2}</div>
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
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Status *</label>
              <select
                required
                name="status"
                value={form.values.status}
                onChange={form.handleChange}
                className={INPUT_CLASS}
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
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

          {form.saveError && (
            <p className="text-sm text-error bg-error-container/20 border border-error/20 rounded-lg px-3 py-2">
              {form.saveError}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              disabled={form.isSaving}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.isSaving}
              className="bg-primary text-on-primary px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[130px]"
            >
              {form.isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Record'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { X, Loader2 } from 'lucide-react';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useEntityForm } from '../hooks/useEntityForm';
import { emptyMaintenanceForm, recordToFormValues, toMaintenanceUpdate } from '../lib/maintenanceForm';

interface EditMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string | null;
}

const INPUT_CLASS =
  'w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

export default function EditMaintenanceModal({ isOpen, onClose, recordId }: EditMaintenanceModalProps) {
  const { records, updateRecord } = useMaintenance();
  const recordToEdit = records.find(r => r.id === recordId);

  const form = useEntityForm({
    // Only reached when the modal is opened without a row; the early return below
    // means the blank form is never rendered.
    initialValues: emptyMaintenanceForm(),
    resetKey: recordToEdit,
    // Re-hydrating on every row change, and on mount when a row is already picked.
    // Losing the row seeds nothing, so the fields are left as they were.
    seed: () => (recordToEdit ? recordToFormValues(recordToEdit) : null),
    errorPrefix: 'Failed to update maintenance record',
  });

  if (!isOpen || !recordToEdit) return null;

  const handleSubmit = form.handleSubmit(async values => {
    const minDelay = new Promise(resolve => setTimeout(resolve, 600));
    await Promise.all([updateRecord(recordToEdit.id, toMaintenanceUpdate(recordToEdit, values)), minDelay]);
    onClose();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <h2 className="text-xl font-bold text-on-surface">Edit Maintenance Record</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
            <X className="h-5 w-5 text-on-surface-variant" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">

          <div className="grid grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant text-sm">
            <div><span className="text-on-surface-variant">Asset:</span> {recordToEdit.assetNumber} - {recordToEdit.assetDescription}</div>
            <div><span className="text-on-surface-variant">Book:</span> {recordToEdit.assetBook}</div>
            <div><span className="text-on-surface-variant">Subsidiary:</span> {recordToEdit.subsidiary}</div>
            <div><span className="text-on-surface-variant">Units:</span> {recordToEdit.assetUnits}</div>
          </div>

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
              className="bg-primary text-on-primary px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
            >
              {form.isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

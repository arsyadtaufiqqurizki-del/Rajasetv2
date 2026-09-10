import { useMaintenance } from '../contexts/MaintenanceContext';
import FormModal from './ui/FormModal';
import { useEntityForm } from '../hooks/useEntityForm';
import { emptyMaintenanceForm, recordToFormValues, toMaintenanceUpdate } from '../lib/maintenanceForm';

interface EditMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string | null;
}

const TITLE_ID = 'edit-maintenance-modal-title';

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
    <FormModal
      isOpen={isOpen}
      titleId={TITLE_ID}
      title="Edit Maintenance Record"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
      isSaving={form.isSaving}
      error={form.saveError}
    >
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
    </FormModal>
  );
}

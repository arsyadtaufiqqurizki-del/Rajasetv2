import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useMaintenance, MaintenanceRecord } from '../contexts/MaintenanceContext';

interface EditMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string | null;
}

export default function EditMaintenanceModal({ isOpen, onClose, recordId }: EditMaintenanceModalProps) {
  const { records, updateRecord } = useMaintenance();
  
  const [formData, setFormData] = useState({
    serviceType: '',
    estimateCost: '',
    actualCost: '',
    status: 'Pending',
    scheduledDate: new Date().toISOString().split('T')[0]
  });

  const recordToEdit = records.find(r => r.id === recordId);

  useEffect(() => {
    if (isOpen && recordToEdit) {
      setFormData({
        serviceType: recordToEdit.serviceType || '',
        estimateCost: recordToEdit.estimateCost || '',
        actualCost: recordToEdit.actualCost || '',
        status: recordToEdit.status || 'Pending',
        scheduledDate: recordToEdit.scheduledDate || new Date().toISOString().split('T')[0]
      });
    }
  }, [isOpen, recordToEdit]);

  if (!isOpen || !recordToEdit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordId) return;

    await updateRecord(recordId, {
      ...recordToEdit,
      serviceType: formData.serviceType,
      estimateCost: formData.estimateCost,
      actualCost: formData.actualCost,
      status: formData.status,
      scheduledDate: formData.scheduledDate
    });

    onClose();
  };

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
                value={formData.scheduledDate}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Service Type *</label>
              <input
                required
                type="text"
                value={formData.serviceType}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Oil Change, Repair"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Status *</label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                value={formData.estimateCost}
                onChange={(e) => setFormData(prev => ({ ...prev, estimateCost: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. $500.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Actual Cost</label>
              <input
                type="text"
                value={formData.actualCost}
                onChange={(e) => setFormData(prev => ({ ...prev, actualCost: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. $450.00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-primary text-on-primary px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

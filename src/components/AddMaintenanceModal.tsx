import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAsset } from '../contexts/AssetContext';
import { useMaintenance } from '../contexts/MaintenanceContext';

interface AddMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddMaintenanceModal({ isOpen, onClose }: AddMaintenanceModalProps) {
  const { assets } = useAsset();
  const { addRecord } = useMaintenance();
  const [selectedAssetId, setSelectedAssetId] = useState('');
  
  const [formData, setFormData] = useState({
    serviceType: '',
    estimateCost: '',
    actualCost: '',
    status: 'Pending',
    scheduledDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedAssetId('');
      setFormData({
        serviceType: '',
        estimateCost: '',
        actualCost: '',
        status: 'Pending',
        scheduledDate: new Date().toISOString().split('T')[0]
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;

    await addRecord({
      assetBook: asset.assetBook || asset.id,
      subsidiary: asset.subsidiary,
      assetNumber: asset.assetNumber,
      assetDescription: asset.assetDescription,
      assetUnits: asset.assetUnits,
      serviceType: formData.serviceType,
      assetCategorySegment1: asset.categorySegment1,
      assetCategorySegment2: asset.categorySegment2,
      estimateCost: formData.estimateCost,
      actualCost: formData.actualCost,
      status: formData.status,
      scheduledDate: formData.scheduledDate
    });

    onClose();
  };

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

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
            <select
              required
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="" disabled>Select an asset</option>
              {assets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetNumber} - {asset.assetDescription}
                </option>
              ))}
            </select>
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
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

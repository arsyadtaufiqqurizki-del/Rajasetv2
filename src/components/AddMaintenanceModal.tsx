import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';
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
  const [assetSearch, setAssetSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    serviceType: '',
    estimateCost: '',
    actualCost: '',
    status: 'Pending',
    scheduledDate: new Date().toISOString().split('T')[0]
  });

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets.slice(0, 50);
    return assets.filter(a =>
      a.assetNumber?.toLowerCase().includes(q) ||
      a.assetDescription?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [assets, assetSearch]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAssetId('');
      setAssetSearch('');
      setDropdownOpen(false);
      setFormData({
        serviceType: '',
        estimateCost: '',
        actualCost: '',
        status: 'Pending',
        scheduledDate: new Date().toISOString().split('T')[0]
      });
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

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
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(prev => !prev)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <span className={selectedAssetId ? 'text-on-surface' : 'text-on-surface-variant'}>
                  {selectedAsset
                    ? `${selectedAsset.assetNumber} - ${selectedAsset.assetDescription}`
                    : 'Select an asset'}
                </span>
                <ChevronDown className="h-4 w-4 text-on-surface-variant shrink-0 ml-2" />
              </button>
              {/* hidden input to satisfy form required validation */}
              <input type="text" required className="sr-only" value={selectedAssetId} readOnly tabIndex={-1} />

              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg">
                  <div className="p-2 border-b border-outline-variant flex items-center gap-2">
                    <Search className="h-4 w-4 text-on-surface-variant shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      value={assetSearch}
                      onChange={e => setAssetSearch(e.target.value)}
                      placeholder="Cari asset number atau deskripsi..."
                      className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                    />
                    {assetSearch && (
                      <button type="button" onClick={() => setAssetSearch('')} className="text-on-surface-variant hover:text-on-surface">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <ul className="max-h-56 overflow-y-auto py-1">
                    {filteredAssets.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-on-surface-variant">Tidak ada hasil</li>
                    ) : (
                      filteredAssets.map(asset => (
                        <li
                          key={asset.id}
                          onClick={() => {
                            setSelectedAssetId(asset.id);
                            setDropdownOpen(false);
                            setAssetSearch('');
                          }}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low ${selectedAssetId === asset.id ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface'}`}
                        >
                          <span className="font-medium">{asset.assetNumber}</span>
                          <span className="text-on-surface-variant"> — {asset.assetDescription}</span>
                        </li>
                      ))
                    )}
                  </ul>
                  {!assetSearch && assets.length > 50 && (
                    <p className="px-3 py-2 text-xs text-on-surface-variant border-t border-outline-variant">
                      Menampilkan 50 dari {assets.length} aset. Ketik untuk mencari.
                    </p>
                  )}
                </div>
              )}
            </div>
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

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAsset } from '../contexts/AssetContext';
import AutocompleteInput from './AutocompleteInput';

export default function AddAssetModal() {
  const { isAddModalOpen, setIsAddModalOpen, addAsset, subsidiaries, categories1, categories2 } = useAsset();
  
  const [formData, setFormData] = useState({
    assetBook: '',
    subsidiary: '',
    assetNumber: '',
    assetDescription: '',
    assetCost: '',
    datePlaceInService: '',
    assetUnits: '1',
    categorySegment1: '',
    categorySegment2: '',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '60',
    listed: 'Audited',
    status: 'Active',
  });

  const [isUnlimitedLife, setIsUnlimitedLife] = useState(false);

  if (!isAddModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      assetCost: formData.assetCost.replace(/,/g, '')
    };
    await addAsset(dataToSave);
    setIsAddModalOpen(false);
    // Reset form
    setFormData({
      assetBook: '',
      subsidiary: '',
      assetNumber: '',
      assetDescription: '',
      assetCost: '',
      datePlaceInService: '',
      assetUnits: '1',
      categorySegment1: '',
      categorySegment2: '',
      depreciationMethod: 'Straight Line',
      lifeInMonths: '60',
      listed: 'Audited',
      status: 'Active',
    });
    setIsUnlimitedLife(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    val = val.replace(/[^\d.]/g, '');
    
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    
    if (!val) {
      setFormData(prev => ({ ...prev, assetCost: '' }));
      return;
    }

    const splitVal = val.split('.');
    const integerPart = splitVal[0];
    const decimalPart = splitVal.length > 1 ? '.' + splitVal[1] : '';

    let formattedInteger = integerPart;
    if (integerPart) {
      formattedInteger = new Intl.NumberFormat('en-US').format(parseInt(integerPart, 10));
    }

    setFormData(prev => ({ ...prev, assetCost: formattedInteger + decimalPart }));
  };

  const handleUnlimitedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsUnlimitedLife(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, lifeInMonths: 'Unlimited' }));
    } else {
      setFormData(prev => ({ ...prev, lifeInMonths: '60' }));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
          <h2 className="text-xl font-bold text-on-surface">Add New Asset</h2>
          <button 
            onClick={() => setIsAddModalOpen(false)}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label className="text-sm font-semibold text-on-surface">Asset Book *</label>
              <input 
                required
                name="assetBook"
                value={formData.assetBook}
                onChange={handleChange}
                placeholder="e.g. Corporate, Tax, AMT"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label className="text-sm font-semibold text-on-surface">Subsidiary *</label>
              <AutocompleteInput 
                required
                name="subsidiary"
                value={formData.subsidiary}
                onChange={handleChange as any}
                placeholder="e.g. PT Raja Prima"
                options={subsidiaries}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Asset Number *</label>
              <input 
                required
                name="assetNumber"
                value={formData.assetNumber}
                onChange={handleChange}
                placeholder="e.g. AST-2026-001"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Asset Description *</label>
              <input 
                required
                name="assetDescription"
                value={formData.assetDescription}
                onChange={handleChange}
                placeholder="e.g. MacBook Pro M3"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Asset Cost *</label>
              <input 
                required
                name="assetCost"
                type="text"
                value={formData.assetCost}
                onChange={handleCostChange}
                placeholder="e.g. 2,499.00"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Date Place in Service *</label>
              <input 
                required
                name="datePlaceInService"
                type="date"
                value={formData.datePlaceInService}
                onChange={handleChange}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Category Segment 1</label>
              <AutocompleteInput 
                name="categorySegment1"
                value={formData.categorySegment1}
                onChange={handleChange as any}
                placeholder="e.g. Electronics"
                options={categories1}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Category Segment 2</label>
              <AutocompleteInput 
                name="categorySegment2"
                value={formData.categorySegment2}
                onChange={handleChange as any}
                placeholder="e.g. Location"
                options={categories2}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Asset Units</label>
              <input 
                type="number"
                name="assetUnits"
                value={formData.assetUnits}
                onChange={handleChange}
                min="1"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-on-surface">Life in Months</label>
                <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isUnlimitedLife} 
                    onChange={handleUnlimitedChange}
                    className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                  />
                  Unlimited
                </label>
              </div>
              <input 
                type={isUnlimitedLife ? "text" : "number"}
                name="lifeInMonths"
                value={isUnlimitedLife ? "Unlimited" : formData.lifeInMonths}
                onChange={handleChange}
                disabled={isUnlimitedLife}
                min={isUnlimitedLife ? undefined : "1"}
                className={`w-full rounded-lg border border-outline-variant px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${isUnlimitedLife ? 'bg-surface-container text-on-surface-variant cursor-not-allowed' : 'bg-surface-container-lowest'}`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Depreciation Method</label>
              <select 
                name="depreciationMethod"
                value={formData.depreciationMethod}
                onChange={handleChange}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="Straight Line">Straight Line</option>
                <option value="Declining Balance">Declining Balance</option>
                <option value="Units of Production">Units of Production</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface">Listed</label>
              <select 
                name="listed"
                value={formData.listed}
                onChange={handleChange}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="Audited">Audited</option>
                <option value="Non-Listed">Non-Listed</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-on-surface">Status</label>
              <select 
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="In Maintenance">In Maintenance</option>
                <option value="Needs Service">Needs Service</option>
                <option value="Broken">Broken</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm"
            >
              Save Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

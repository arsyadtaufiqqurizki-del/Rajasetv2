import React, { useEffect, useState } from 'react';
import { useAsset } from '../contexts/AssetContext';
import AutocompleteInput from './ui/AutocompleteInput';
import FormModal from './ui/FormModal';
import { applyListedChange, applyVerificationChange } from '../lib/assetRules';
import { formatCostInput } from '../lib/money';

const TITLE_ID = 'add-asset-modal-title';

const EMPTY_FORM_DATA = {
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
  verification: 'No',
  verificationDate: '',
  itemStatus: '',
};

export default function AddAssetModal() {
  const { isAddModalOpen, setIsAddModalOpen, addAsset, subsidiaries, categories1, categories2, itemStatuses } = useAsset();

  const [formData, setFormData] = useState(EMPTY_FORM_DATA);
  const [isUnlimitedLife, setIsUnlimitedLife] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAddModalOpen) {
      setIsSaving(false);
      setSaveError(null);
    }
  }, [isAddModalOpen]);

  const handleClose = () => {
    if (isSaving) return;
    setIsAddModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        assetCost: formData.assetCost.replace(/,/g, ''),
        verification: formData.verification === 'Yes',
      };
      await addAsset(dataToSave);
      setIsAddModalOpen(false);
      // Reset form
      setFormData(EMPTY_FORM_DATA);
      setIsUnlimitedLife(false);
    } catch (err) {
      setSaveError('Failed to save asset: ' + (err instanceof Error ? err.message : 'An unexpected error occurred.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleVerificationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData(prev => applyVerificationChange(prev, value));
  };

  const handleListedChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setFormData(prev => applyListedChange(prev, value));
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCostInput(e.target.value);
    setFormData(prev => ({ ...prev, assetCost: formatted }));
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
    <FormModal
      isOpen={isAddModalOpen}
      titleId={TITLE_ID}
      title="Add New Asset"
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="Save Asset"
      isSaving={isSaving}
      error={saveError}
    >
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
          <label className="text-sm font-semibold text-on-surface">Asset Class</label>
          <AutocompleteInput 
            name="categorySegment1"
            value={formData.categorySegment1}
            onChange={handleChange as any}
            placeholder="e.g. Electronics"
            options={categories1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-on-surface">Location</label>
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
          <div role="radiogroup" aria-label="Depreciation Method" className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
            {['Straight Line', 'Declining Balance', 'Units of Production'].map((method) => {
              const isUnderMaintenance = method === 'Units of Production';
              return (
                <label
                  key={method}
                  className={`flex items-center gap-2 text-sm ${isUnderMaintenance ? 'text-on-surface-variant cursor-not-allowed' : 'text-on-surface cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="depreciationMethod"
                    value={method}
                    checked={formData.depreciationMethod === method}
                    onChange={handleChange}
                    disabled={isUnderMaintenance}
                    className="h-4 w-4 border-outline-variant text-primary focus:ring-primary disabled:cursor-not-allowed"
                  />
                  {method}
                  {isUnderMaintenance && (
                    <span className="text-xs text-on-surface-variant">(Maintenance)</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-on-surface">Listed</label>
          <div role="radiogroup" aria-label="Listed" className="flex items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
            {['Audited', 'Non-Listed'].map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
                <input
                  type="radio"
                  name="listed"
                  value={option}
                  checked={formData.listed === option}
                  onChange={handleListedChange}
                  className="h-4 w-4 border-outline-variant text-primary focus:ring-primary"
                />
                {option}
              </label>
            ))}
          </div>
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-on-surface">Verification</label>
          <div role="radiogroup" aria-label="Verification" className="flex items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5">
            {['No', 'Yes'].map((option) => {
              const isLockedByAudited = option === 'No' && formData.listed === 'Audited';
              return (
                <label
                  key={option}
                  className={`flex items-center gap-2 text-sm ${isLockedByAudited ? 'text-on-surface-variant cursor-not-allowed' : 'text-on-surface cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="verification"
                    value={option}
                    checked={formData.verification === option}
                    onChange={handleVerificationChange}
                    disabled={isLockedByAudited}
                    className="h-4 w-4 border-outline-variant text-primary focus:ring-primary disabled:cursor-not-allowed"
                  />
                  {option}
                  {isLockedByAudited && (
                    <span className="text-xs text-on-surface-variant">(Audited requires Yes)</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-on-surface">Verification Date</label>
          <input
            name="verificationDate"
            type="date"
            value={formData.verificationDate}
            onChange={handleChange}
            disabled={formData.verification !== 'Yes'}
            className={`w-full rounded-lg border border-outline-variant px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${formData.verification !== 'Yes' ? 'bg-surface-container text-on-surface-variant cursor-not-allowed' : 'bg-surface-container-lowest'}`}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-semibold text-on-surface">Item Status</label>
          <AutocompleteInput
            name="itemStatus"
            value={formData.itemStatus}
            onChange={handleChange as any}
            placeholder="e.g. Asset, Inventory, Needs Review"
            options={itemStatuses}
          />
        </div>
      </div>
    </FormModal>
  );
}

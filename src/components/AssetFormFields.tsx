import React from 'react';
import AutocompleteInput from './ui/AutocompleteInput';
import { applyListedChange, applyVerificationChange } from '../lib/assetRules';
import { formatCostInput } from '../lib/money';
import type { EntityForm } from '../hooks/useEntityForm';
import type { AssetFormValues } from '../lib/assetForm';

/**
 * The 16 Asset fields, shared by AddAssetModal and EditAssetModal (Step 6 of
 * "refactoring v2.md" — the two files held 89% identical markup).
 *
 * Everything that differs between Add and Edit stays in the modals: the title,
 * the button label, the mount condition, the error prefix and where the initial
 * values come from. This component knows only the fields and the cross-field rules.
 * The form's shape and its save mapping live in `lib/assetForm.ts`.
 */

const LABEL_CLASS = 'text-sm font-semibold text-on-surface';
const INPUT_CLASS =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
/** INPUT_CLASS without the background, which the disabled/enabled branch supplies instead. */
const TOGGLABLE_INPUT_CLASS =
  'w-full rounded-lg border border-outline-variant px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
const DISABLED_BG_CLASS = 'bg-surface-container text-on-surface-variant cursor-not-allowed';
const ENABLED_BG_CLASS = 'bg-surface-container-lowest';

interface AssetFormFieldsProps {
  form: EntityForm<AssetFormValues>;
  subsidiaries: string[];
  categories1: string[];
  categories2: string[];
  itemStatuses: string[];
}

export default function AssetFormFields({
  form,
  subsidiaries,
  categories1,
  categories2,
  itemStatuses,
}: AssetFormFieldsProps) {
  const { values, setValues, handleChange } = form;

  // Not state of its own: the checkbox is on exactly when the field holds the
  // literal "Unlimited", which is the only way that value can get there.
  const isUnlimitedLife = values.lifeInMonths === 'Unlimited';

  const handleVerificationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setValues(prev => applyVerificationChange(prev, value));
  };

  const handleListedChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setValues(prev => applyListedChange(prev, value));
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCostInput(e.target.value);
    setValues(prev => ({ ...prev, assetCost: formatted }));
  };

  const handleUnlimitedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setValues(prev => ({ ...prev, lifeInMonths: checked ? 'Unlimited' : '60' }));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <label className={LABEL_CLASS}>Asset Book *</label>
        <input
          required
          name="assetBook"
          value={values.assetBook}
          onChange={handleChange}
          placeholder="e.g. Corporate, Tax, AMT"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <label className={LABEL_CLASS}>Subsidiary *</label>
        <AutocompleteInput
          required
          name="subsidiary"
          value={values.subsidiary}
          onChange={handleChange}
          placeholder="e.g. PT Raja Prima"
          options={subsidiaries}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Asset Number *</label>
        <input
          required
          name="assetNumber"
          value={values.assetNumber}
          onChange={handleChange}
          placeholder="e.g. AST-2026-001"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Asset Description *</label>
        <input
          required
          name="assetDescription"
          value={values.assetDescription}
          onChange={handleChange}
          placeholder="e.g. MacBook Pro M3"
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Asset Cost *</label>
        <input
          required
          name="assetCost"
          type="text"
          value={values.assetCost}
          onChange={handleCostChange}
          placeholder="e.g. 2,499.00"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Date Place in Service *</label>
        <input
          required
          name="datePlaceInService"
          type="date"
          value={values.datePlaceInService}
          onChange={handleChange}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Asset Class</label>
        <AutocompleteInput
          name="categorySegment1"
          value={values.categorySegment1}
          onChange={handleChange}
          placeholder="e.g. Electronics"
          options={categories1}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Location</label>
        <AutocompleteInput
          name="categorySegment2"
          value={values.categorySegment2}
          onChange={handleChange}
          placeholder="e.g. Location"
          options={categories2}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Asset Units</label>
        <input
          type="number"
          name="assetUnits"
          value={values.assetUnits}
          onChange={handleChange}
          min="1"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={LABEL_CLASS}>Life in Months</label>
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
          type={isUnlimitedLife ? 'text' : 'number'}
          name="lifeInMonths"
          value={values.lifeInMonths}
          onChange={handleChange}
          disabled={isUnlimitedLife}
          min={isUnlimitedLife ? undefined : '1'}
          className={`${TOGGLABLE_INPUT_CLASS} ${isUnlimitedLife ? DISABLED_BG_CLASS : ENABLED_BG_CLASS}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Depreciation Method</label>
        <div
          role="radiogroup"
          aria-label="Depreciation Method"
          className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5"
        >
          {['Straight Line', 'Declining Balance', 'Units of Production'].map(method => {
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
                  checked={values.depreciationMethod === method}
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
        <label className={LABEL_CLASS}>Listed</label>
        <div
          role="radiogroup"
          aria-label="Listed"
          className="flex items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5"
        >
          {['Audited', 'Non-Listed'].map(option => (
            <label key={option} className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
              <input
                type="radio"
                name="listed"
                value={option}
                checked={values.listed === option}
                onChange={handleListedChange}
                className="h-4 w-4 border-outline-variant text-primary focus:ring-primary"
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={LABEL_CLASS}>Status</label>
        <select
          name="status"
          value={values.status}
          onChange={handleChange}
          className={`${INPUT_CLASS} cursor-pointer`}
        >
          <option value="Active">Active</option>
          <option value="In Maintenance">In Maintenance</option>
          <option value="Needs Service">Needs Service</option>
          <option value="Broken">Broken</option>
          <option value="Retired">Retired</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS}>Verification</label>
        <div
          role="radiogroup"
          aria-label="Verification"
          className="flex items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5"
        >
          {['No', 'Yes'].map(option => {
            const isLockedByAudited = option === 'No' && values.listed === 'Audited';
            return (
              <label
                key={option}
                className={`flex items-center gap-2 text-sm ${isLockedByAudited ? 'text-on-surface-variant cursor-not-allowed' : 'text-on-surface cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="verification"
                  value={option}
                  checked={values.verification === option}
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
        <label className={LABEL_CLASS}>Verification Date</label>
        <input
          name="verificationDate"
          type="date"
          value={values.verificationDate}
          onChange={handleChange}
          disabled={values.verification !== 'Yes'}
          className={`${TOGGLABLE_INPUT_CLASS} ${values.verification !== 'Yes' ? DISABLED_BG_CLASS : ENABLED_BG_CLASS}`}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={LABEL_CLASS}>Item Status</label>
        <AutocompleteInput
          name="itemStatus"
          value={values.itemStatus}
          onChange={handleChange}
          placeholder="e.g. Asset, Inventory, Needs Review"
          options={itemStatuses}
        />
      </div>
    </div>
  );
}

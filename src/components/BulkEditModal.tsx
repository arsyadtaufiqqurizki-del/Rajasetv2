import { useEffect, useState } from 'react';
import type { AssetBulkPatch } from '../types/asset';
import Modal from './ui/Modal';

interface BulkEditModalProps {
  isOpen: boolean;
  selectedCount: number;
  onCancel: () => void;
  onApply: (patch: AssetBulkPatch) => void;
}

const TITLE_ID = 'bulk-edit-modal-title';

const DEPRECIATION_METHODS = ['Straight Line', 'Declining Balance', 'Units of Production'];
const LISTED_OPTIONS = ['Audited', 'Non-Listed'];
const STATUS_OPTIONS = ['Active', 'In Maintenance', 'Needs Service', 'Broken', 'Retired'];

export default function BulkEditModal({ isOpen, selectedCount, onCancel, onApply }: BulkEditModalProps) {
  const [enabled, setEnabled] = useState({
    depreciationMethod: false,
    listed: false,
    status: false,
  });
  const [values, setValues] = useState({
    depreciationMethod: 'Straight Line',
    listed: 'Audited',
    status: 'Active',
  });

  useEffect(() => {
    if (isOpen) {
      setEnabled({ depreciationMethod: false, listed: false, status: false });
      setValues({ depreciationMethod: 'Straight Line', listed: 'Audited', status: 'Active' });
    }
  }, [isOpen]);

  const toggleField = (key: keyof typeof enabled) => {
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  const handleApply = () => {
    const patch: AssetBulkPatch = {};
    if (enabled.depreciationMethod) patch.depreciationMethod = values.depreciationMethod;
    if (enabled.listed) patch.listed = values.listed;
    if (enabled.status) patch.status = values.status;
    onApply(patch);
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} labelledBy={TITLE_ID} className="max-w-2xl">
      <div className="flex items-center justify-between p-6 border-b border-outline-variant/30">
        <h2 id={TITLE_ID} className="text-xl font-bold text-on-surface">
          Edit Selected Assets
        </h2>
      </div>

      <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
        <p className="text-sm text-on-surface-variant">
          Only the fields you enable below will be updated. Applies to <strong>{selectedCount}</strong> selected asset{selectedCount === 1 ? '' : 's'}.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm font-semibold text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={enabled.depreciationMethod}
              onChange={() => toggleField('depreciationMethod')}
              className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            Depreciation Method
          </label>
          <div
            role="radiogroup"
            aria-label="Depreciation Method"
            className={`flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 ${enabled.depreciationMethod ? '' : 'opacity-50'}`}
          >
            {DEPRECIATION_METHODS.map((method) => {
              const isUnderMaintenance = method === 'Units of Production';
              return (
                <label
                  key={method}
                  className={`flex items-center gap-2 text-sm ${isUnderMaintenance || !enabled.depreciationMethod ? 'text-on-surface-variant cursor-not-allowed' : 'text-on-surface cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="bulk-depreciationMethod"
                    value={method}
                    checked={values.depreciationMethod === method}
                    onChange={(e) => setValues(prev => ({ ...prev, depreciationMethod: e.target.value }))}
                    disabled={!enabled.depreciationMethod || isUnderMaintenance}
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
          <label className="flex items-center gap-2 text-sm font-semibold text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={enabled.listed}
              onChange={() => toggleField('listed')}
              className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            Listed
          </label>
          <div
            role="radiogroup"
            aria-label="Listed"
            className={`flex items-center gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 ${enabled.listed ? '' : 'opacity-50'}`}
          >
            {LISTED_OPTIONS.map((option) => (
              <label
                key={option}
                className={`flex items-center gap-2 text-sm ${enabled.listed ? 'text-on-surface cursor-pointer' : 'text-on-surface-variant cursor-not-allowed'}`}
              >
                <input
                  type="radio"
                  name="bulk-listed"
                  value={option}
                  checked={values.listed === option}
                  onChange={(e) => setValues(prev => ({ ...prev, listed: e.target.value }))}
                  disabled={!enabled.listed}
                  className="h-4 w-4 border-outline-variant text-primary focus:ring-primary disabled:cursor-not-allowed"
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm font-semibold text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={enabled.status}
              onChange={() => toggleField('status')}
              className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            Status
          </label>
          <select
            value={values.status}
            onChange={(e) => setValues(prev => ({ ...prev, status: e.target.value }))}
            disabled={!enabled.status}
            className={`w-full rounded-lg border border-outline-variant px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ${enabled.status ? 'bg-surface-container-lowest' : 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'}`}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="mt-2 pt-4 border-t border-outline-variant/30 flex items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">
            Applying <strong>{enabledCount}</strong> change{enabledCount === 1 ? '' : 's'} to <strong>{selectedCount}</strong> selected asset{selectedCount === 1 ? '' : 's'}.
          </p>
          <div className="flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={enabledCount === 0}
              className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg shadow-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

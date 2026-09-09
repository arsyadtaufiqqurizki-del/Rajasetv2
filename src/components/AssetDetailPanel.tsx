import type { ReactNode } from 'react';
import { Edit2, X } from 'lucide-react';
import type { Asset } from '../contexts/AssetContext';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/money';
import { formatDateDMY } from '../lib/dates';
import Modal from './ui/Modal';

interface AssetDetailPanelProps {
  asset: Asset | null;
  bookValue: number;
  onClose: () => void;
  onEdit: (asset: Asset) => void;
}

const TITLE_ID = 'asset-detail-panel-title';

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className="text-sm text-on-surface">{value || '—'}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-outline-variant/30 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export default function AssetDetailPanel({ asset, bookValue, onClose, onEdit }: AssetDetailPanelProps) {
  if (!asset) return null;

  return (
    <Modal isOpen={asset !== null} onClose={onClose} labelledBy={TITLE_ID} className="max-w-lg max-h-[85vh] flex flex-col">
      <div className="flex items-start justify-between p-6 border-b border-outline-variant/30 shrink-0">
        <div>
          <h2 id={TITLE_ID} className="text-xl font-bold text-on-surface">
            {asset.assetNumber || asset.assetDescription}
          </h2>
          <p className="text-sm text-on-surface-variant">{asset.assetDescription}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <Section title="Identity">
          <Field label="Asset Book" value={asset.assetBook} />
          <Field label="Subsidiary" value={asset.subsidiary} />
          <Field label="Asset Class" value={asset.categorySegment1} />
          <Field label="Location" value={asset.categorySegment2} />
          <Field label="Item Status" value={asset.itemStatus} />
        </Section>

        <Section title="Value">
          <Field label="Asset Cost" value={formatCurrency(asset.assetCost)} />
          <Field label="Book Value" value={asset.assetCost === '' ? '-' : formatCurrency(bookValue)} />
          <Field label="Depreciation Method" value={asset.depreciationMethod} />
          <Field label="Life in Months" value={asset.lifeInMonths} />
          <Field label="Asset Units" value={asset.assetUnits} />
          <Field label="Date Place in Service" value={formatDateDMY(asset.datePlaceInService)} />
        </Section>

        <Section title="Status">
          <Field
            label="Status"
            value={
              <span className={cn(
                "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
                asset.statusLevel === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                asset.statusLevel === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" :
                asset.statusLevel === 'error' ? "bg-error-container/40 border-error/20 text-on-error-container" :
                "bg-surface-variant text-on-surface-variant border-outline-variant/50"
              )}>
                {asset.status}
              </span>
            }
          />
          <Field label="Listed" value={asset.listed} />
          <Field
            label="Verification"
            value={
              <span className={cn(
                "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
                asset.verification ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-surface-variant text-on-surface-variant border-outline-variant/50"
              )}>
                {asset.verification ? 'Yes' : 'No'}
              </span>
            }
          />
          <Field label="Verification Date" value={formatDateDMY(asset.verificationDate)} />
        </Section>
      </div>

      <div className="flex justify-end gap-3 p-6 border-t border-outline-variant/30 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors rounded-lg"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => onEdit(asset)}
          className="px-5 py-2.5 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm flex items-center gap-2"
        >
          <Edit2 className="h-4 w-4" />
          Edit Asset
        </button>
      </div>
    </Modal>
  );
}

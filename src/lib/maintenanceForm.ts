import { todayIso } from './assetRules';
import type { Asset } from '../types/asset';
import type { MaintenanceInput, MaintenanceRecord } from '../types/maintenance';

/**
 * The shape of the Maintenance form and the mappings at its two edges. Split out of
 * AddMaintenanceModal / EditMaintenanceModal in Step 7 of "refactoring v2.md", the
 * same way lib/assetForm.ts was split out of the Asset pair in Step 6.
 *
 * The pair is *not* merged into one component: Add picks an asset and assembles a
 * record around it, Edit shows the stored identity read-only and writes only the
 * five service fields. Only the shape and the mappings are shared.
 */

/** The five fields both modals edit. Add carries the picked asset alongside them. */
export type MaintenanceFormValues = {
  serviceType: string;
  estimateCost: string;
  actualCost: string;
  status: string;
  scheduledDate: string;
};

export type AddMaintenanceFormValues = MaintenanceFormValues & {
  /** id of the asset picked in the dropdown, '' until one is chosen */
  assetId: string;
};

/**
 * A blank form. Built fresh on each call rather than frozen as a constant because
 * `scheduledDate` defaults to today — a module-level constant would pin the date to
 * whenever the bundle was first evaluated.
 */
export function emptyMaintenanceForm(): MaintenanceFormValues {
  return {
    serviceType: '',
    estimateCost: '',
    actualCost: '',
    status: 'Pending',
    scheduledDate: todayIso(),
  };
}

export function emptyAddMaintenanceForm(): AddMaintenanceFormValues {
  return { assetId: '', ...emptyMaintenanceForm() };
}

/** Hydrates the Edit form from a stored row, falling back the way the row does. */
export function recordToFormValues(record: MaintenanceRecord): MaintenanceFormValues {
  return {
    serviceType: record.serviceType || '',
    estimateCost: record.estimateCost || '',
    actualCost: record.actualCost || '',
    status: record.status || 'Pending',
    scheduledDate: record.scheduledDate || todayIso(),
  };
}

/**
 * Assembles a brand-new record: the identity half is copied off the picked asset,
 * the service half comes from the form. `assetBook` falls back to the asset id for
 * assets that have no book of their own.
 */
export function toMaintenancePayload(asset: Asset, values: MaintenanceFormValues): MaintenanceInput {
  return {
    assetBook: asset.assetBook || asset.id,
    subsidiary: asset.subsidiary,
    assetNumber: asset.assetNumber,
    assetDescription: asset.assetDescription,
    assetUnits: asset.assetUnits,
    serviceType: values.serviceType,
    assetCategorySegment1: asset.categorySegment1,
    assetCategorySegment2: asset.categorySegment2,
    estimateCost: values.estimateCost,
    actualCost: values.actualCost,
    status: values.status,
    scheduledDate: values.scheduledDate,
  };
}

/**
 * Writes the five edited fields over the stored row. The whole record is spread —
 * `id` included — because that is what updateRecord has always been handed.
 */
export function toMaintenanceUpdate(
  record: MaintenanceRecord,
  values: MaintenanceFormValues,
): MaintenanceInput {
  return {
    ...record,
    serviceType: values.serviceType,
    estimateCost: values.estimateCost,
    actualCost: values.actualCost,
    status: values.status,
    scheduledDate: values.scheduledDate,
  };
}

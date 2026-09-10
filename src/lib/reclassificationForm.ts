import { RECLASSIFICATION_PRESET_CATEGORIES } from '../types/reclassification';
import type { Reclassification, ReclassificationInput } from '../types/reclassification';

/**
 * The audit classification is stored as one free-text column but edited through two
 * controls: a preset dropdown plus a text box that only appears for "Custom". Both
 * reclassification modals had their own copy of the split and the join; Step 7 of
 * "refactoring v2.md" moves them here.
 *
 * ⛔ The preset values themselves are database values matched by the assets <->
 * asset_reclassifications sync trigger. They are not UI copy and must not be
 * translated — see Step 8a note 1.
 */

/** Sentinel value of the dropdown that reveals the free-text box. */
export const CUSTOM_CATEGORY = 'Custom';

export function isPresetCategory(category: string): boolean {
  return (RECLASSIFICATION_PRESET_CATEGORIES as readonly string[]).includes(category);
}

/** Splits a stored category into the two controls that edit it. */
export function splitCategory(stored: string): { categorySelect: string; customCategory: string } {
  return isPresetCategory(stored)
    ? { categorySelect: stored, customCategory: '' }
    : { categorySelect: CUSTOM_CATEGORY, customCategory: stored };
}

/**
 * Joins the two controls back into the stored value. Returns '' when the custom box
 * is blank — both modals read that as "not ready, don't submit".
 */
export function resolveCategory(categorySelect: string, customCategory: string): string {
  return categorySelect === CUSTOM_CATEGORY ? customCategory.trim() : categorySelect;
}

/** Add: pick an existing asset, classify it, note why. Nothing else is editable. */
export type AddReclassificationFormValues = {
  /** id of the asset picked in the dropdown, '' until one is chosen */
  assetId: string;
  categorySelect: string;
  customCategory: string;
  remarks: string;
};

export const EMPTY_ADD_RECLASSIFICATION_FORM: AddReclassificationFormValues = {
  assetId: '',
  categorySelect: RECLASSIFICATION_PRESET_CATEGORIES[0],
  customCategory: '',
  remarks: '',
};

/**
 * Edit: the identity fields as well — though a row linked to Asset Inventory renders
 * them disabled, since those columns mirror the asset live and aren't stored here.
 */
export type EditReclassificationFormValues = {
  assetCategory: string;
  assetDescription: string;
  location: string;
  unit: string;
  ownership: string;
  remarks: string;
  categorySelect: string;
  customCategory: string;
};

/** Only reached when the modal is opened without a row; the modal returns null first. */
export const EMPTY_EDIT_RECLASSIFICATION_FORM: EditReclassificationFormValues = {
  assetCategory: '',
  assetDescription: '',
  location: '',
  unit: '1',
  ownership: '',
  remarks: '',
  categorySelect: RECLASSIFICATION_PRESET_CATEGORIES[1],
  customCategory: '',
};

export function reclassificationToFormValues(row: Reclassification): EditReclassificationFormValues {
  return {
    assetCategory: row.assetCategory,
    assetDescription: row.assetDescription,
    location: row.location,
    unit: row.unit,
    ownership: row.ownership,
    remarks: row.remarks,
    ...splitCategory(row.category),
  };
}

/** The payload updateReclassification has always been handed: the six fields plus the joined category. */
export function toReclassificationPayload(
  values: EditReclassificationFormValues,
  category: string,
): ReclassificationInput {
  return {
    assetCategory: values.assetCategory,
    assetDescription: values.assetDescription,
    location: values.location,
    unit: values.unit,
    ownership: values.ownership,
    remarks: values.remarks,
    category,
  };
}

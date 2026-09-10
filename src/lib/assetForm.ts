import type { AssetInput } from '../types/asset';

/**
 * The shape of the Asset form and the mappings at its two edges — the blank form
 * Add opens with, and the payload both modals save. Split out of AssetFormFields
 * in Step 6 of "refactoring v2.md" so the pure parts can be tested (and imported)
 * without rendering 16 fields.
 */

/** Every field is a string while it is in the form; `verification` only becomes a boolean on save. */
export type AssetFormValues = {
  assetBook: string;
  subsidiary: string;
  assetNumber: string;
  assetDescription: string;
  assetCost: string;
  datePlaceInService: string;
  assetUnits: string;
  categorySegment1: string;
  categorySegment2: string;
  depreciationMethod: string;
  lifeInMonths: string;
  listed: string;
  status: string;
  verification: string;
  verificationDate: string;
  itemStatus: string;
};

/** A blank form — what AddAssetModal opens with and returns to after a successful save. */
export const EMPTY_ASSET_FORM: AssetFormValues = {
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

/** Form values -> the payload addAsset/updateAsset take: commas out of the cost, verification back to a boolean. */
export function toAssetPayload(values: AssetFormValues): AssetInput {
  return {
    ...values,
    assetCost: values.assetCost.replace(/,/g, ''),
    verification: values.verification === 'Yes',
  };
}

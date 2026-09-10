import { formatCostInput } from './money';
import type { Asset, AssetInput } from '../types/asset';

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

/**
 * A stored row -> the form EditAssetModal opens with. Two things happen here that
 * Add has no equivalent for: the cost is stored unformatted, so it goes back
 * through the same formatter the field uses (difference 1 of the four Step 6
 * listed in "refactoring v2.md"), and verification comes back as a boolean.
 */
export function assetToFormValues(asset: Asset): AssetFormValues {
  return {
    assetBook: asset.assetBook,
    subsidiary: asset.subsidiary || '',
    assetNumber: asset.assetNumber,
    assetDescription: asset.assetDescription,
    assetCost: formatCostInput(asset.assetCost || ''),
    datePlaceInService: asset.datePlaceInService,
    assetUnits: asset.assetUnits,
    categorySegment1: asset.categorySegment1,
    categorySegment2: asset.categorySegment2,
    depreciationMethod: asset.depreciationMethod,
    lifeInMonths: asset.lifeInMonths,
    listed: asset.listed,
    status: asset.status,
    verification: asset.verification ? 'Yes' : 'No',
    verificationDate: asset.verificationDate || '',
    itemStatus: asset.itemStatus || '',
  };
}

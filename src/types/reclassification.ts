export type ReclassificationCategory = 'Asset' | 'Needs Review' | 'Inventory' | string;

export const RECLASSIFICATION_PRESET_CATEGORIES = ['Asset', 'Needs Review', 'Inventory'] as const;

export type Reclassification = {
  id: string;
  assetId: string | null;
  linkedAssetNumber: string;
  assetCategory: string;
  assetDescription: string;
  location: string;
  unit: string;
  ownership: string;
  category: ReclassificationCategory;
  remarks: string;
  verified: boolean;
  verificationDate: string;
  verifiedBy: string;
  createdAt: string;
};

export type ReclassificationInput = Omit<
  Reclassification,
  'id' | 'assetId' | 'linkedAssetNumber' | 'verified' | 'verificationDate' | 'verifiedBy' | 'createdAt'
>;

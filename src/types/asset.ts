export type AssetStatusLevel = 'success' | 'warning' | 'error' | 'default';

export type Asset = {
  id: string;
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
  statusLevel: AssetStatusLevel;
  verification: boolean;
  verificationDate: string;
  itemStatus: string;
  createdAt: string;
};

export type AssetInput = Omit<Asset, 'id' | 'statusLevel' | 'createdAt'>;

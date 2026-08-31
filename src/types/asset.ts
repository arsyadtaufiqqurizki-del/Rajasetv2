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

/**
 * Field yang boleh diubah lewat bulk edit — Tahap 1 saja (Depreciation Method, Listed, Status).
 * `itemStatus` dan `verification` sengaja belum ada di sini: keduanya memicu trigger sync
 * `assets` <-> `asset_reclassifications` dan menunggu Opsi 1 di "reclassification trigger fix.md"
 * sebelum masuk scope. Lihat "bulk edit asset inventory.md" kotak di awal dokumen.
 */
export type AssetBulkPatch = Partial<Pick<Asset, 'depreciationMethod' | 'listed' | 'status'>>;

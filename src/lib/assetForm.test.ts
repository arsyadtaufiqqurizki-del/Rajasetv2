import { describe, it, expect } from 'vitest';
import { EMPTY_ASSET_FORM, toAssetPayload } from './assetForm';

// Step 6 of "refactoring v2.md". The payload mapping used to be written out twice,
// inline in AddAssetModal and EditAssetModal. Both modals' characterization tests
// still pin it end to end; these run it without rendering 16 fields.

describe('EMPTY_ASSET_FORM', () => {
  it('opens on the defaults the blank Add form shows', () => {
    expect(EMPTY_ASSET_FORM).toEqual({
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
    });
  });
});

describe('toAssetPayload', () => {
  it('strips thousand separators from the cost and turns verification into a boolean', () => {
    const payload = toAssetPayload({
      ...EMPTY_ASSET_FORM,
      assetCost: '1,234,567.89',
      verification: 'Yes',
    });

    expect(payload.assetCost).toBe('1234567.89');
    expect(payload.verification).toBe(true);
  });

  it('reads anything other than "Yes" as unverified', () => {
    expect(toAssetPayload({ ...EMPTY_ASSET_FORM, verification: 'No' }).verification).toBe(false);
    expect(toAssetPayload({ ...EMPTY_ASSET_FORM, verification: '' }).verification).toBe(false);
  });

  it('passes every other field through untouched', () => {
    const values = {
      ...EMPTY_ASSET_FORM,
      assetBook: 'Corporate',
      assetNumber: 'AST-2026-001',
      lifeInMonths: 'Unlimited',
      itemStatus: 'Asset',
    };

    expect(toAssetPayload(values)).toEqual({
      ...values,
      assetCost: '',
      verification: false,
    });
  });
});

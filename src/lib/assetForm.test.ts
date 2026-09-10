import { describe, it, expect } from 'vitest';
import { EMPTY_ASSET_FORM, assetToFormValues, toAssetPayload } from './assetForm';
import type { Asset } from '../types/asset';

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

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    assetBook: 'Corporate',
    subsidiary: 'PT Raja Prima',
    assetNumber: 'AST-2026-001',
    assetDescription: 'MacBook Pro M3',
    assetCost: '2499.00',
    datePlaceInService: '2026-01-15',
    assetUnits: '1',
    categorySegment1: 'Electronics',
    categorySegment2: 'HQ',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '60',
    listed: 'Audited',
    status: 'Active',
    statusLevel: 'success',
    verification: true,
    verificationDate: '2026-02-01',
    itemStatus: 'Asset',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('assetToFormValues', () => {
  it('copies the row into the form and drops the fields the form has no input for', () => {
    expect(assetToFormValues(makeAsset())).toEqual({
      assetBook: 'Corporate',
      subsidiary: 'PT Raja Prima',
      assetNumber: 'AST-2026-001',
      assetDescription: 'MacBook Pro M3',
      assetCost: '2,499.00',
      datePlaceInService: '2026-01-15',
      assetUnits: '1',
      categorySegment1: 'Electronics',
      categorySegment2: 'HQ',
      depreciationMethod: 'Straight Line',
      lifeInMonths: '60',
      listed: 'Audited',
      status: 'Active',
      verification: 'Yes',
      verificationDate: '2026-02-01',
      itemStatus: 'Asset',
    });
  });

  it.each([
    ['2499.00', '2,499.00'],
    ['1234567', '1,234,567'],
    ['1234567.89', '1,234,567.89'],
    ['', ''],
    ['.5', '.5'],
  ])('re-formats a stored cost of %s as %s (difference 1)', (stored, shown) => {
    expect(assetToFormValues(makeAsset({ assetCost: stored })).assetCost).toBe(shown);
  });

  it('turns verification back into a Yes/No string', () => {
    expect(assetToFormValues(makeAsset({ verification: false })).verification).toBe('No');
  });

  it('substitutes empty strings for the nullable columns', () => {
    const values = assetToFormValues(
      makeAsset({ subsidiary: '', verificationDate: '', itemStatus: '' }),
    );

    expect(values.subsidiary).toBe('');
    expect(values.verificationDate).toBe('');
    expect(values.itemStatus).toBe('');
  });

  it('round-trips through toAssetPayload without changing the stored values', () => {
    const asset = makeAsset({ assetCost: '1234567.89' });
    const payload = toAssetPayload(assetToFormValues(asset));

    expect(payload.assetCost).toBe('1234567.89');
    expect(payload.verification).toBe(true);
  });
});

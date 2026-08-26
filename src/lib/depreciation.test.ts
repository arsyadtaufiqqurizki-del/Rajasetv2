import { describe, it, expect } from 'vitest';
import { computeBookValue, totalBookValue } from './depreciation';
import type { Asset } from '../types/asset';

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    id: 'base',
    assetBook: 'Book A',
    subsidiary: 'Alpha',
    assetNumber: 'AN-000',
    assetDescription: 'Generic Asset',
    assetCost: '1200',
    datePlaceInService: '2024-01-01',
    assetUnits: '1',
    categorySegment1: 'IT Equipment',
    categorySegment2: 'HQ',
    depreciationMethod: 'Straight Line',
    lifeInMonths: '36',
    listed: 'Yes',
    status: 'Active',
    statusLevel: 'success',
    verification: true,
    verificationDate: '2024-01-01',
    itemStatus: 'In Use',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeBookValue — edge cases', () => {
  it('empty assetCost → bookValue 0', () => {
    const result = computeBookValue(makeAsset({ assetCost: '' }), new Date('2025-01-01'));
    expect(result.cost).toBe(0);
    expect(result.bookValue).toBe(0);
  });

  it('parses formatted assetCost ("$1,200.50")', () => {
    const result = computeBookValue(
      makeAsset({ assetCost: '$1,200.50', lifeInMonths: '', datePlaceInService: '' }),
      new Date('2025-01-01')
    );
    expect(result.cost).toBe(1200.5);
    expect(result.bookValue).toBe(1200.5);
  });

  it('lifeInMonths "Unlimited" → bookValue = cost forever, non-depreciable', () => {
    const asset = makeAsset({ lifeInMonths: 'Unlimited' });
    const result = computeBookValue(asset, new Date('2040-01-01'));
    expect(result.bookValue).toBe(1200);
    expect(result.isNonDepreciable).toBe(true);
    expect(result.remainingLifeMonths).toBeNull();
  });

  it.each(['0', '', 'abc'])('lifeInMonths %j → bookValue = cost, non-depreciable', (lifeInMonths) => {
    const asset = makeAsset({ lifeInMonths });
    const result = computeBookValue(asset, new Date('2030-01-01'));
    expect(result.bookValue).toBe(1200);
    expect(result.isNonDepreciable).toBe(true);
  });

  it('empty datePlaceInService → bookValue = cost', () => {
    const asset = makeAsset({ datePlaceInService: '' });
    const result = computeBookValue(asset, new Date('2030-01-01'));
    expect(result.bookValue).toBe(1200);
    expect(result.isNonDepreciable).toBe(true);
  });

  it('datePlaceInService in the future → bookValue = cost', () => {
    const asset = makeAsset({ datePlaceInService: '2030-01-01' });
    const result = computeBookValue(asset, new Date('2025-01-01'));
    expect(result.bookValue).toBe(1200);
    expect(result.ageMonths).toBe(0);
  });

  it('ageMonths exactly equal to life → bookValue = 0', () => {
    // 36 months from 2024-01-01 is 2027-01-01.
    const asset = makeAsset({ lifeInMonths: '36' });
    const result = computeBookValue(asset, new Date('2027-01-01'));
    expect(result.ageMonths).toBe(36);
    expect(result.bookValue).toBe(0);
  });

  it('ageMonths beyond life → bookValue = 0, never negative', () => {
    const asset = makeAsset({ lifeInMonths: '36' });
    const result = computeBookValue(asset, new Date('2035-01-01'));
    expect(result.bookValue).toBe(0);
    expect(result.isFullyDepreciated).toBe(true);
  });

  it('straight line, half of useful life elapsed → bookValue = cost / 2', () => {
    // 18 months from 2024-01-01 is 2025-07-01 — exactly half of a 36-month life.
    const asset = makeAsset({ lifeInMonths: '36', depreciationMethod: 'Straight Line' });
    const result = computeBookValue(asset, new Date('2025-07-01'));
    expect(result.bookValue).toBe(600);
    expect(result.accumulatedDepreciation).toBe(600);
  });
});

describe('computeBookValue — depreciation methods', () => {
  it('Declining Balance yields a lower book value than Straight Line at mid-life', () => {
    const asOf = new Date('2025-07-01'); // 18 months in, 36-month life
    const straightLine = computeBookValue(
      makeAsset({ lifeInMonths: '36', depreciationMethod: 'Straight Line' }),
      asOf
    );
    const decliningBalance = computeBookValue(
      makeAsset({ lifeInMonths: '36', depreciationMethod: 'Declining Balance' }),
      asOf
    );
    expect(decliningBalance.bookValue).toBeLessThan(straightLine.bookValue);
    expect(decliningBalance.bookValue).toBeGreaterThan(0);
  });

  it('Declining Balance reaches exactly 0 once useful life is exhausted', () => {
    const asset = makeAsset({ lifeInMonths: '36', depreciationMethod: 'Declining Balance' });
    const result = computeBookValue(asset, new Date('2027-01-01'));
    expect(result.bookValue).toBe(0);
  });

  it('Units of Production falls back to Straight Line', () => {
    const asOf = new Date('2025-07-01');
    const unitsOfProduction = computeBookValue(
      makeAsset({ lifeInMonths: '36', depreciationMethod: 'Units of Production' }),
      asOf
    );
    const straightLine = computeBookValue(
      makeAsset({ lifeInMonths: '36', depreciationMethod: 'Straight Line' }),
      asOf
    );
    expect(unitsOfProduction.bookValue).toBe(straightLine.bookValue);
  });
});

describe('totalBookValue', () => {
  it('returns 0 for an empty asset list', () => {
    expect(totalBookValue([], new Date('2025-01-01'))).toBe(0);
  });

  it('sums book values across assets using an explicit asOf', () => {
    const asOf = new Date('2025-07-01');
    const assets = [
      makeAsset({ id: '1', assetCost: '1200', lifeInMonths: '36' }),
      makeAsset({ id: '2', assetCost: '800', lifeInMonths: 'Unlimited' }),
    ];
    // asset 1: half of 36-month life elapsed → 600. asset 2: non-depreciable → 800.
    expect(totalBookValue(assets, asOf)).toBe(1400);
  });

  it('is deterministic for a fixed asOf regardless of the current date', () => {
    const asOf = new Date('2020-01-01');
    const asset = makeAsset({ datePlaceInService: '2019-01-01', lifeInMonths: '36' });
    const first = computeBookValue(asset, asOf).bookValue;
    const second = computeBookValue(asset, asOf).bookValue;
    expect(first).toBe(second);
  });
});

import type { Asset } from '../types/asset';
import { parseCost } from './money';
import { monthsBetween } from './dates';

export type BookValueResult = {
  /** Parsed acquisition cost; 0 if invalid. */
  cost: number;
  /** Accumulated depreciation as of `asOf`. Always within 0..cost. */
  accumulatedDepreciation: number;
  /** Book value = cost - accumulatedDepreciation. Always within 0..cost. */
  bookValue: number;
  /** Full months elapsed since placed in service, as of `asOf`. */
  ageMonths: number;
  /** Remaining useful life in months; null when life is unlimited. */
  remainingLifeMonths: number | null;
  /** True when the asset never depreciates (unlimited/invalid life or no service date). */
  isNonDepreciable: boolean;
  /** True when book value has reached 0. */
  isFullyDepreciated: boolean;
};

/** Book value of an asset as of `asOf` (default: now). */
export function computeBookValue(asset: Asset, asOf: Date = new Date()): BookValueResult {
  const cost = parseCost(asset.assetCost);

  const lifeRaw = asset.lifeInMonths?.trim() ?? '';
  const isUnlimited = lifeRaw.toLowerCase() === 'unlimited';
  const life = Number(lifeRaw);
  const hasValidLife = !isUnlimited && Number.isFinite(life) && life > 0;

  const placedInService = asset.datePlaceInService ? new Date(asset.datePlaceInService) : null;
  const hasValidServiceDate = placedInService !== null && !isNaN(placedInService.getTime());

  if (isUnlimited || !hasValidLife || !hasValidServiceDate) {
    return {
      cost,
      accumulatedDepreciation: 0,
      bookValue: cost,
      ageMonths: 0,
      remainingLifeMonths: isUnlimited ? null : hasValidLife ? life : null,
      isNonDepreciable: true,
      isFullyDepreciated: false,
    };
  }

  const ageMonths = monthsBetween(placedInService, asOf);
  const effectiveAge = Math.min(ageMonths, life);

  let bookValue: number;
  if (asset.depreciationMethod === 'Declining Balance') {
    // Double-declining balance on a monthly basis; forced to 0 once useful life is exhausted
    // so behavior matches straight-line at the boundary.
    bookValue = effectiveAge >= life ? 0 : cost * Math.pow(1 - 2 / life, effectiveAge);
  } else {
    // 'Straight Line', 'Units of Production' (no production-unit data in the schema to compute
    // it properly — falls back to straight-line, matching prior Reports behavior), and any
    // other/empty value all use straight-line.
    bookValue = cost * (1 - effectiveAge / life);
  }

  bookValue = Math.min(cost, Math.max(0, bookValue));
  const accumulatedDepreciation = cost - bookValue;

  return {
    cost,
    accumulatedDepreciation,
    bookValue,
    ageMonths,
    remainingLifeMonths: Math.max(0, life - effectiveAge),
    isNonDepreciable: false,
    isFullyDepreciated: bookValue === 0,
  };
}

/** Sum of book values across a set of assets — for KPI/footer totals. */
export function totalBookValue(assets: Asset[], asOf: Date = new Date()): number {
  return assets.reduce((sum, a) => sum + computeBookValue(a, asOf).bookValue, 0);
}

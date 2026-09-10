import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyListedChange, applyVerificationChange, todayIso } from './assetRules';

// Unit tests for the Listed <-> Verification rules extracted from AddAssetModal /
// EditAssetModal in Step 2 of "refactoring v2.md". The rendered-behaviour versions
// stay in AddAssetModal.test.tsx; these pin the rules without a DOM.

const FROZEN = new Date('2026-09-10T03:00:00.000Z');
const TODAY = '2026-09-10';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
});

afterEach(() => {
  vi.useRealTimers();
});

function form(overrides: Partial<{ listed: string; verification: string; verificationDate: string; assetNumber: string }> = {}) {
  return {
    listed: 'Non-Listed',
    verification: 'No',
    verificationDate: '',
    assetNumber: 'AN-001',
    ...overrides,
  };
}

describe('todayIso', () => {
  it('returns the date part only, in the format a date input carries', () => {
    expect(todayIso()).toBe(TODAY);
  });
});

describe('applyVerificationChange', () => {
  it('stamps today when switched to Yes with no date set', () => {
    const next = applyVerificationChange(form(), 'Yes');

    expect(next.verification).toBe('Yes');
    expect(next.verificationDate).toBe(TODAY);
  });

  it('keeps a date the user already picked', () => {
    const next = applyVerificationChange(form({ verificationDate: '2024-01-15' }), 'Yes');

    expect(next.verificationDate).toBe('2024-01-15');
  });

  it('clears the date when switched to No', () => {
    const next = applyVerificationChange(form({ verification: 'Yes', verificationDate: '2024-01-15' }), 'No');

    expect(next.verification).toBe('No');
    expect(next.verificationDate).toBe('');
  });

  it('clears the date for any value that is not exactly "Yes"', () => {
    expect(applyVerificationChange(form({ verificationDate: '2024-01-15' }), 'yes').verificationDate).toBe('');
  });

  it('leaves every other field untouched', () => {
    const next = applyVerificationChange(form(), 'Yes');

    expect(next.assetNumber).toBe('AN-001');
    expect(next.listed).toBe('Non-Listed');
  });

  it('does not mutate the input', () => {
    const prev = form();
    applyVerificationChange(prev, 'Yes');

    expect(prev.verification).toBe('No');
    expect(prev.verificationDate).toBe('');
  });
});

describe('applyListedChange', () => {
  it('forces Verification to Yes and stamps today when set to Audited', () => {
    const next = applyListedChange(form(), 'Audited');

    expect(next.listed).toBe('Audited');
    expect(next.verification).toBe('Yes');
    expect(next.verificationDate).toBe(TODAY);
  });

  it('keeps a verification date the user already picked when going to Audited', () => {
    const next = applyListedChange(form({ verification: 'Yes', verificationDate: '2024-01-15' }), 'Audited');

    expect(next.verificationDate).toBe('2024-01-15');
  });

  it('leaves verification and its date alone when set to Non-Listed', () => {
    const next = applyListedChange(form({ listed: 'Audited', verification: 'Yes', verificationDate: '2024-01-15' }), 'Non-Listed');

    expect(next.listed).toBe('Non-Listed');
    expect(next.verification).toBe('Yes');
    expect(next.verificationDate).toBe('2024-01-15');
  });

  it('does not clear an unverified row when set to Non-Listed', () => {
    const next = applyListedChange(form(), 'Non-Listed');

    expect(next.verification).toBe('No');
    expect(next.verificationDate).toBe('');
  });

  it('does not mutate the input', () => {
    const prev = form();
    applyListedChange(prev, 'Audited');

    expect(prev.listed).toBe('Non-Listed');
    expect(prev.verification).toBe('No');
  });
});

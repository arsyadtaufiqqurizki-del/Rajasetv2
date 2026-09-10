import { describe, it, expect } from 'vitest';
import { formatCostInput } from './money';

// Pins formatCostInput, extracted from the three identical copies in
// AddAssetModal / EditAssetModal in Step 2 of "refactoring v2.md". The cases marked
// "pinned in AddAssetModal.test.tsx" must stay in sync with that suite.

describe('formatCostInput', () => {
  it.each([
    // [input, expected] — the seven cases pinned in AddAssetModal.test.tsx
    ['2499', '2,499'],
    ['1234567', '1,234,567'],
    ['1234567.89', '1,234,567.89'],
    ['1a2b3c', '123'],
    ['1.2.3', '1.23'],
    ['.5', '.5'],
    ['0012', '12'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatCostInput(input)).toBe(expected);
  });

  it('returns an empty string for empty input', () => {
    expect(formatCostInput('')).toBe('');
  });

  it('returns an empty string when nothing survives the digit filter', () => {
    expect(formatCostInput('abc')).toBe('');
    expect(formatCostInput('$ ,')).toBe('');
  });

  it('is idempotent — re-formatting its own output changes nothing', () => {
    expect(formatCostInput('2,499')).toBe('2,499');
    expect(formatCostInput('1,234,567.89')).toBe('1,234,567.89');
  });

  it('re-formats when a digit is appended to an already-separated value', () => {
    expect(formatCostInput('2,4990')).toBe('24,990');
  });

  it('keeps a trailing dot so a decimal can still be typed', () => {
    expect(formatCostInput('1234.')).toBe('1,234.');
  });

  it('does not round or pad the decimal tail', () => {
    expect(formatCostInput('1000.5')).toBe('1,000.5');
    expect(formatCostInput('1000.567')).toBe('1,000.567');
  });

  it('collapses every extra dot into the first decimal group', () => {
    expect(formatCostInput('1.2.3.4')).toBe('1.234');
  });

  it('strips currency symbols and existing separators', () => {
    expect(formatCostInput('$150,000.55')).toBe('150,000.55');
  });

  it('drops a leading minus — the field is unsigned', () => {
    expect(formatCostInput('-500')).toBe('500');
  });
});

import { describe, it, expect } from 'vitest';
import {
  CUSTOM_CATEGORY,
  EMPTY_ADD_RECLASSIFICATION_FORM,
  EMPTY_EDIT_RECLASSIFICATION_FORM,
  isPresetCategory,
  reclassificationToFormValues,
  resolveCategory,
  splitCategory,
  toReclassificationPayload,
} from './reclassificationForm';
import type { Reclassification } from '../types/reclassification';

const ROW: Reclassification = {
  id: 'r1',
  assetId: null,
  linkedAssetNumber: '',
  assetCategory: 'Elektronik',
  assetDescription: 'Kompresor GA-30',
  location: 'Gudang A',
  unit: '2',
  ownership: 'Divisi Operasional',
  category: 'Needs Review',
  remarks: 'Perlu dicek ulang',
  assetDeletedAt: null,
  verified: false,
  verificationDate: '',
  verifiedBy: '',
  createdAt: '2026-01-01',
};

describe('isPresetCategory', () => {
  it('recognises the three stored preset values', () => {
    expect(isPresetCategory('Asset')).toBe(true);
    expect(isPresetCategory('Needs Review')).toBe(true);
    expect(isPresetCategory('Inventory')).toBe(true);
  });

  it('treats anything else — the Custom sentinel included — as not a preset', () => {
    expect(isPresetCategory('Barang Hilang')).toBe(false);
    expect(isPresetCategory(CUSTOM_CATEGORY)).toBe(false);
    expect(isPresetCategory('')).toBe(false);
    expect(isPresetCategory('asset')).toBe(false);
  });
});

describe('splitCategory', () => {
  it('leaves a preset in the dropdown and the text box empty', () => {
    expect(splitCategory('Inventory')).toEqual({ categorySelect: 'Inventory', customCategory: '' });
  });

  it('drops anything else into the Custom text box', () => {
    expect(splitCategory('Barang Hilang')).toEqual({
      categorySelect: CUSTOM_CATEGORY,
      customCategory: 'Barang Hilang',
    });
  });

  it('sends a stored blank down the Custom branch, leaving the box blank too', () => {
    expect(splitCategory('')).toEqual({ categorySelect: CUSTOM_CATEGORY, customCategory: '' });
  });
});

describe('resolveCategory', () => {
  it('returns the preset as-is and ignores whatever is in the custom box', () => {
    expect(resolveCategory('Asset', 'leftover')).toBe('Asset');
  });

  it('trims the custom name', () => {
    expect(resolveCategory(CUSTOM_CATEGORY, '  Barang Hilang  ')).toBe('Barang Hilang');
  });

  it('returns an empty string for a blank custom name — both modals read that as "do not submit"', () => {
    expect(resolveCategory(CUSTOM_CATEGORY, '')).toBe('');
    expect(resolveCategory(CUSTOM_CATEGORY, '   ')).toBe('');
  });

  it('round-trips every preset through split and back', () => {
    for (const preset of ['Asset', 'Needs Review', 'Inventory']) {
      const { categorySelect, customCategory } = splitCategory(preset);
      expect(resolveCategory(categorySelect, customCategory)).toBe(preset);
    }
  });

  it('round-trips a custom value through split and back', () => {
    const { categorySelect, customCategory } = splitCategory('Barang Hilang');
    expect(resolveCategory(categorySelect, customCategory)).toBe('Barang Hilang');
  });
});

describe('blank forms', () => {
  it('opens Add on the first preset', () => {
    expect(EMPTY_ADD_RECLASSIFICATION_FORM).toEqual({
      assetId: '',
      categorySelect: 'Asset',
      customCategory: '',
      remarks: '',
    });
  });

  it('opens Edit on the second preset — the two deliberately differ', () => {
    expect(EMPTY_EDIT_RECLASSIFICATION_FORM.categorySelect).toBe('Needs Review');
    expect(EMPTY_ADD_RECLASSIFICATION_FORM.categorySelect).toBe('Asset');
  });

  it('defaults the Edit unit to 1', () => {
    expect(EMPTY_EDIT_RECLASSIFICATION_FORM.unit).toBe('1');
  });
});

describe('reclassificationToFormValues', () => {
  it('copies the six stored fields and splits the category', () => {
    expect(reclassificationToFormValues(ROW)).toEqual({
      assetCategory: 'Elektronik',
      assetDescription: 'Kompresor GA-30',
      location: 'Gudang A',
      unit: '2',
      ownership: 'Divisi Operasional',
      remarks: 'Perlu dicek ulang',
      categorySelect: 'Needs Review',
      customCategory: '',
    });
  });

  it('hydrates a non-preset category into the Custom branch', () => {
    const values = reclassificationToFormValues({ ...ROW, category: 'Barang Hilang' });
    expect(values.categorySelect).toBe(CUSTOM_CATEGORY);
    expect(values.customCategory).toBe('Barang Hilang');
  });

  it('leaves the audit-only columns out of the form entirely', () => {
    const values = reclassificationToFormValues(ROW);
    expect(values).not.toHaveProperty('verified');
    expect(values).not.toHaveProperty('verifiedBy');
    expect(values).not.toHaveProperty('assetId');
  });
});

describe('toReclassificationPayload', () => {
  it('sends the six fields plus the resolved category, and nothing else', () => {
    const values = reclassificationToFormValues(ROW);
    expect(toReclassificationPayload(values, 'Inventory')).toEqual({
      assetCategory: 'Elektronik',
      assetDescription: 'Kompresor GA-30',
      location: 'Gudang A',
      unit: '2',
      ownership: 'Divisi Operasional',
      remarks: 'Perlu dicek ulang',
      category: 'Inventory',
    });
  });

  it('drops the two dropdown-only fields — they are UI state, not columns', () => {
    const payload = toReclassificationPayload(reclassificationToFormValues(ROW), 'Asset');
    expect(payload).not.toHaveProperty('categorySelect');
    expect(payload).not.toHaveProperty('customCategory');
  });

  it('round-trips a row through the form without changing what is stored', () => {
    const values = reclassificationToFormValues(ROW);
    const payload = toReclassificationPayload(values, resolveCategory(values.categorySelect, values.customCategory));
    expect(payload).toEqual({
      assetCategory: ROW.assetCategory,
      assetDescription: ROW.assetDescription,
      location: ROW.location,
      unit: ROW.unit,
      ownership: ROW.ownership,
      remarks: ROW.remarks,
      category: ROW.category,
    });
  });
});

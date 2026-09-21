import { describe, it, expect } from 'vitest';
import {
  MAX_IMPORT_ROWS,
  buildExportRows,
  mapCsvRowToAssetInput,
  normalizeListed,
  partitionCsvRows,
  type AssetCsvField,
  type AssetCsvRow,
} from './assetCsv';
import { sanitizeCell } from './csv';
import { normalizeImportDate } from './dates';
import { en as copy } from '../i18n/en';
import type { Asset } from '../types/asset';

// Unit tests for the CSV logic extracted from Inventory.tsx in Step 2 of
// "refactoring v2.md". The export side is additionally gated byte-for-byte by
// src/pages/Inventory.export.test.tsx against the golden fixture.

describe('normalizeListed', () => {
  it.each(['Audited', 'audited', '  AUDITED  ', 'Yes', 'yes'])('maps %s to Audited', (input) => {
    expect(normalizeListed(input)).toBe('Audited');
  });

  it.each(['Non-Listed', 'no', '', '   ', 'whatever', undefined])('maps %s to Non-Listed', (input) => {
    expect(normalizeListed(input)).toBe('Non-Listed');
  });
});

describe('normalizeImportDate', () => {
  it.each([
    ['2024-01-01', '2024-01-01'],
    ['  2024-01-01  ', '2024-01-01'],
    ['2024-1-5', '2024-01-05'],
    ['2024/03/28', '2024-03-28'],
    ['2024-03-28T00:00:00', '2024-03-28'],
    ['28-03-2019', '2019-03-28'],
    ['28/03/2019', '2019-03-28'],
    ['28-03-19', '2019-03-28'],
    ['28/03/19', '2019-03-28'],
    ['5-3-24', '2024-03-05'],
    ['01-01-70', '1970-01-01'],
    ['01-01-69', '2069-01-01'],
    ['29-02-2024', '2024-02-29'],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(normalizeImportDate(raw)).toBe(expected);
  });

  it.each([undefined, '', '   '])('treats %s as an empty cell', (raw) => {
    expect(normalizeImportDate(raw)).toBe('');
  });

  it.each([
    'not-a-date',
    '28-03',
    '2019-13-01',
    '2019-00-10',
    '32-01-2019',
    '31-02-2024',
    '29-02-2023',
    '03-28-2019',
    '43555',
    '28-03-201',
  ])('rejects %s as invalid', (raw) => {
    expect(normalizeImportDate(raw)).toBeNull();
  });
});

describe('partitionCsvRows', () => {
  it('keeps rows that have both an asset number and a description', () => {
    const { validRows, invalidRows } = partitionCsvRows([
      { 'Asset Number': 'AN-001', 'Asset Description': 'Laptop' },
    ]);

    expect(validRows).toHaveLength(1);
    expect(invalidRows).toHaveLength(0);
  });

  it('accepts camelCase headers as well as the human ones', () => {
    const { validRows } = partitionCsvRows([{ assetNumber: 'AN-001', assetDescription: 'Laptop' }]);

    expect(validRows).toHaveLength(1);
  });

  it('rejects a row missing the asset number, naming that reason', () => {
    const { validRows, invalidRows } = partitionCsvRows([
      { 'Asset Number': '', 'Asset Description': 'Laptop' },
    ]);

    expect(validRows).toHaveLength(0);
    expect(invalidRows[0].reason).toBe(copy.csvImport.missingAssetNumber);
  });

  it('rejects a row missing the description, naming that reason', () => {
    const { invalidRows } = partitionCsvRows([{ 'Asset Number': 'AN-001', 'Asset Description': '' }]);

    expect(invalidRows[0].reason).toBe(copy.csvImport.missingAssetDescription);
  });

  it('joins both reasons when both fields are empty', () => {
    const { invalidRows } = partitionCsvRows([{}]);

    expect(invalidRows[0].reason).toBe(
      `${copy.csvImport.missingAssetNumber}, ${copy.csvImport.missingAssetDescription}`
    );
  });

  it('numbers rejected rows against the file, counting the header line', () => {
    const { invalidRows } = partitionCsvRows([
      { 'Asset Number': 'AN-001', 'Asset Description': 'Laptop' }, // file row 2 — valid
      { 'Asset Number': '', 'Asset Description': 'Monitor' },      // file row 3
      { 'Asset Number': 'AN-003', 'Asset Description': '' },       // file row 4
    ]);

    expect(invalidRows.map(r => r.rowNumber)).toEqual([3, 4]);
  });

  it('echoes back whatever the rejected row did carry', () => {
    const { invalidRows } = partitionCsvRows([{ 'Asset Number': 'AN-002', 'Asset Description': '' }]);

    expect(invalidRows[0]).toMatchObject({ assetNumber: 'AN-002', assetDescription: '' });
  });

  it('preserves input order and returns empty lists for an empty file', () => {
    expect(partitionCsvRows([])).toEqual({ validRows: [], validRowNumbers: [], invalidRows: [] });
  });

  it('caps import at 5000 rows', () => {
    expect(MAX_IMPORT_ROWS).toBe(5000);
  });

  it('keeps rows with Indonesian DD-MM-YY dates and blank dates', () => {
    const { validRows, invalidRows } = partitionCsvRows([
      { 'Asset Number': 'AN-001', 'Asset Description': 'Laptop', 'Date Place In Service': '28-03-19' },
      { 'Asset Number': 'AN-002', 'Asset Description': 'Monitor' },
    ]);

    expect(validRows).toHaveLength(2);
    expect(invalidRows).toHaveLength(0);
  });

  it('rejects a row with an impossible date, naming the field and value', () => {
    const { validRows, invalidRows } = partitionCsvRows([
      { 'Asset Number': 'AN-001', 'Asset Description': 'Laptop', 'Date Place In Service': '31-02-2024' },
    ]);

    expect(validRows).toHaveLength(0);
    expect(invalidRows[0].reason).toBe(copy.csvImport.invalidDatePlaceInService('31-02-2024'));
  });

  it('rejects a row with an invalid verification date', () => {
    const { invalidRows } = partitionCsvRows([
      { 'Asset Number': 'AN-001', 'Asset Description': 'Laptop', 'Verification Date': 'yesterday' },
    ]);

    expect(invalidRows[0].reason).toBe(copy.csvImport.invalidVerificationDate('yesterday'));
  });
});

describe('mapCsvRowToAssetInput', () => {
  const FULL: AssetCsvRow = {
    'Asset Book': 'Corporate',
    'Subsidiary': 'PT Raja Prima',
    'Asset Number': 'AN-001',
    'Asset Description': 'Laptop',
    'Asset Cost': '2499.00',
    'Date Place In Service': '2024-01-01',
    'Asset Units': '2',
    'Asset Category Segment 1': 'IT Equipment',
    'Asset Category Segment 2': 'HQ',
    'Depreciation Method': 'Straight Line',
    'Life in Months': '36',
    'Listed': 'Audited',
    'Status': 'Active',
    'Verification': 'Yes',
    'Verification Date': '2024-06-01',
    'Item Status': 'Asset',
  };

  it('maps a fully populated row across without altering values', () => {
    expect(mapCsvRowToAssetInput(FULL)).toEqual({
      assetBook: 'Corporate',
      subsidiary: 'PT Raja Prima',
      assetNumber: 'AN-001',
      assetDescription: 'Laptop',
      assetCost: '2499.00',
      datePlaceInService: '2024-01-01',
      assetUnits: '2',
      categorySegment1: 'IT Equipment',
      categorySegment2: 'HQ',
      depreciationMethod: 'Straight Line',
      lifeInMonths: '36',
      listed: 'Audited',
      status: 'Active',
      verification: true,
      verificationDate: '2024-06-01',
      itemStatus: 'Asset',
    });
  });

  it('applies the sparse-file defaults', () => {
    const mapped = mapCsvRowToAssetInput({ 'Asset Number': 'AN-001', 'Asset Description': 'Laptop' });

    expect(mapped).toMatchObject({
      subsidiary: 'Default',
      assetCost: '0',
      assetUnits: '1',
      categorySegment1: 'Uncategorized',
      categorySegment2: 'Uncategorized',
      lifeInMonths: '0',
      status: 'Active',
      listed: 'Non-Listed',
      verification: false,
    });
  });

  it('leaves the optional text fields empty rather than defaulting them', () => {
    const mapped = mapCsvRowToAssetInput({ 'Asset Number': 'AN-001', 'Asset Description': 'Laptop' });

    expect(mapped.assetBook).toBe('');
    expect(mapped.datePlaceInService).toBe('');
    expect(mapped.verificationDate).toBe('');
    expect(mapped.itemStatus).toBe('');
  });

  it('reads camelCase headers when the human ones are absent', () => {
    const mapped = mapCsvRowToAssetInput({
      assetNumber: 'AN-001',
      assetDescription: 'Laptop',
      assetCost: '750',
      lifeInMonths: '24',
    });

    expect(mapped).toMatchObject({ assetNumber: 'AN-001', assetCost: '750', lifeInMonths: '24' });
  });

  it('prefers the human header when a row carries both spellings', () => {
    const mapped = mapCsvRowToAssetInput({
      'Asset Number': 'HUMAN',
      assetNumber: 'CAMEL',
      'Asset Description': 'Laptop',
    });

    expect(mapped.assetNumber).toBe('HUMAN');
  });

  it.each([
    ['Yes', true],
    ['yes', true],
    ['  YES  ', true],
    ['No', false],
    ['', false],
    ['true', false],
  ])('reads Verification %s as %s', (raw, expected) => {
    const mapped = mapCsvRowToAssetInput({
      'Asset Number': 'AN-001',
      'Asset Description': 'Laptop',
      'Verification': raw as string,
    });

    expect(mapped.verification).toBe(expected);
  });

  it('normalizes Listed rather than passing it through', () => {
    const mapped = mapCsvRowToAssetInput({
      'Asset Number': 'AN-001',
      'Asset Description': 'Laptop',
      'Listed': 'yes',
    });

    expect(mapped.listed).toBe('Audited');
  });

  it('normalizes Indonesian date formats to ISO for Postgres', () => {
    const mapped = mapCsvRowToAssetInput({
      'Asset Number': 'AN-001',
      'Asset Description': 'Laptop',
      'Date Place In Service': '28-03-19',
      'Verification Date': '05/06/2024',
    });

    expect(mapped.datePlaceInService).toBe('2019-03-28');
    expect(mapped.verificationDate).toBe('2024-06-05');
  });
});

describe('buildExportRows', () => {
  const FIELDS: Record<string, AssetCsvField> = {
    assetNumber: { header: 'Asset Number', value: (a) => a.assetNumber },
    assetDescription: { header: 'Asset Description', value: (a) => a.assetDescription },
    bookValue: { header: 'Book Value', value: (a, bv) => bv.get(a.id) ?? 0 },
    verification: { header: 'Verification', value: (a) => (a.verification ? 'Yes' : 'No') },
  };

  const asset = {
    id: 'a-1',
    assetNumber: 'AN-001',
    assetDescription: 'Laptop',
    verification: true,
  } as Asset;

  it('emits one object per asset, keyed by header, in the requested column order', () => {
    const rows = buildExportRows([asset], ['assetDescription', 'assetNumber'], FIELDS, new Map(), sanitizeCell);

    expect(Object.keys(rows[0])).toEqual(['Asset Description', 'Asset Number']);
    expect(rows[0]).toEqual({ 'Asset Description': 'Laptop', 'Asset Number': 'AN-001' });
  });

  it('resolves book value from the map, falling back to 0 for a missing id', () => {
    expect(buildExportRows([asset], ['bookValue'], FIELDS, new Map([['a-1', 1234]]), sanitizeCell)[0])
      .toEqual({ 'Book Value': 1234 });
    expect(buildExportRows([asset], ['bookValue'], FIELDS, new Map(), sanitizeCell)[0])
      .toEqual({ 'Book Value': 0 });
  });

  it('runs every value through the injected sanitizer', () => {
    const injected = { ...asset, assetDescription: '=SUM(A1:A2)' } as Asset;

    const rows = buildExportRows([injected], ['assetDescription'], FIELDS, new Map(), sanitizeCell);

    expect(rows[0]['Asset Description']).toBe("'=SUM(A1:A2)");
  });

  it('leaves non-string values untouched by the sanitizer', () => {
    const rows = buildExportRows([asset], ['bookValue'], FIELDS, new Map([['a-1', -5]]), sanitizeCell);

    expect(rows[0]['Book Value']).toBe(-5);
  });

  it('returns an empty list for no assets', () => {
    expect(buildExportRows([], ['assetNumber'], FIELDS, new Map(), sanitizeCell)).toEqual([]);
  });
});

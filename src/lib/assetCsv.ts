import type { Asset, AssetInput } from '../types/asset';
import { en as copy } from '../i18n/en';

/**
 * CSV import/export logic for Asset Inventory, lifted out of Inventory.tsx in Step 2
 * of "refactoring v2.md". Pure functions only — no React, no Supabase, no DOM — so the
 * mapping and validation rules can be tested without rendering the page.
 *
 * The export side is pinned byte-for-byte by src/pages/Inventory.export.test.tsx.
 */

/** A row as Papa Parse hands it back with `header: true` — every cell is a string, keys are the CSV headers. */
export type AssetCsvRow = Record<string, string | undefined>;

/** A row that failed validation, in the shape ImportProgressModal renders and downloads. */
export type InvalidCsvRow = {
  rowNumber: number;
  assetNumber: string;
  assetDescription: string;
  reason: string;
};

/** Import is refused above this many parsed rows. */
export const MAX_IMPORT_ROWS = 5000;

/**
 * Collapses the free-text Listed column to the two values the app stores.
 * Anything that is not 'audited'/'yes' becomes 'Non-Listed' — including blanks.
 */
export function normalizeListed(value: string | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'audited' || normalized === 'yes') return 'Audited';
  return 'Non-Listed';
}

/** Accepts either the human header ("Asset Number") or the camelCase field name, in that order. */
function cell(row: AssetCsvRow, header: string, field: string): string {
  return row[header] || row[field] || '';
}

/**
 * Splits parsed rows into importable ones and rejects. A row is rejected when Asset
 * Number or Asset Description is empty; `rowNumber` is 1-based over the file, so it
 * counts the header line (index 0 -> row 2).
 */
export function partitionCsvRows(rows: AssetCsvRow[]): {
  validRows: AssetCsvRow[];
  invalidRows: InvalidCsvRow[];
} {
  const validRows: AssetCsvRow[] = [];
  const invalidRows: InvalidCsvRow[] = [];

  rows.forEach((row, index) => {
    const assetNumber = cell(row, 'Asset Number', 'assetNumber');
    const assetDescription = cell(row, 'Asset Description', 'assetDescription');

    const reasons: string[] = [];
    if (!assetNumber) reasons.push(copy.csvImport.missingAssetNumber);
    if (!assetDescription) reasons.push(copy.csvImport.missingAssetDescription);

    if (reasons.length > 0) {
      invalidRows.push({
        rowNumber: index + 2, // +2: row 1 is the header
        assetNumber,
        assetDescription,
        reason: reasons.join(', '),
      });
    } else {
      validRows.push(row);
    }
  });

  return { validRows, invalidRows };
}

/**
 * Maps one validated CSV row onto the payload `addAsset` expects, applying the
 * defaults a sparse file relies on ('Default' subsidiary, 'Uncategorized' segments,
 * 'Active' status). Only call this on rows that came back from `partitionCsvRows`.
 */
export function mapCsvRowToAssetInput(row: AssetCsvRow): AssetInput {
  return {
    assetBook: cell(row, 'Asset Book', 'assetBook'),
    subsidiary: cell(row, 'Subsidiary', 'subsidiary') || 'Default',
    assetNumber: cell(row, 'Asset Number', 'assetNumber'),
    assetDescription: cell(row, 'Asset Description', 'assetDescription'),
    assetCost: cell(row, 'Asset Cost', 'assetCost') || '0',
    datePlaceInService: cell(row, 'Date Place In Service', 'datePlaceInService'),
    assetUnits: cell(row, 'Asset Units', 'assetUnits') || '1',
    categorySegment1: cell(row, 'Asset Category Segment 1', 'categorySegment1') || 'Uncategorized',
    categorySegment2: cell(row, 'Asset Category Segment 2', 'categorySegment2') || 'Uncategorized',
    depreciationMethod: cell(row, 'Depreciation Method', 'depreciationMethod'),
    lifeInMonths: cell(row, 'Life in Months', 'lifeInMonths') || '0',
    listed: normalizeListed(row['Listed'] || row['listed']),
    status: cell(row, 'Status', 'status') || 'Active',
    verification: String(cell(row, 'Verification', 'verification') || 'No').trim().toLowerCase() === 'yes',
    verificationDate: cell(row, 'Verification Date', 'verificationDate'),
    itemStatus: cell(row, 'Item Status', 'itemStatus'),
  };
}

/** One exportable column: the CSV header to write and how to read the value off an asset. */
export type AssetCsvField = {
  header: string;
  value: (asset: Asset, bookValues: Map<string, number>) => unknown;
};

/**
 * Builds the row objects handed to `toCsvBlob`, in `columnIds` order. `sanitize` is
 * injected (Inventory passes `sanitizeCell`) so this module stays independent of the
 * CSV writer; `fields` is injected so lib/ does not have to import a component.
 */
export function buildExportRows(
  assets: Asset[],
  columnIds: string[],
  fields: Record<string, AssetCsvField>,
  bookValues: Map<string, number>,
  sanitize: (value: unknown) => unknown,
): Record<string, unknown>[] {
  return assets.map(asset => {
    const row: Record<string, unknown> = {};
    for (const columnId of columnIds) {
      const field = fields[columnId];
      row[field.header] = sanitize(field.value(asset, bookValues));
    }
    return row;
  });
}

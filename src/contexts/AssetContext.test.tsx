import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AssetProvider, useAsset } from './AssetContext';
import { fetchAllRows } from '../lib/supabase/fetchAllRows';
import { batchDelete, batchUpdate } from '../lib/supabase/batchWrite';

// Step 3 of "refactoring v2.md" moved AssetContext's chunked fetch and batch
// write loops into lib/supabase/; Step 4 moved the four master-data blocks into
// useLookupTable and the modal trio into useEntityModals. Those modules' own
// unit tests pin their semantics (chunk 1000, batch 100, progress ordering,
// optimistic writes); what is pinned here is the wiring — which table and
// options the context asks for, and how it reconciles local state.

vi.mock('../lib/supabase/fetchAllRows', () => ({ fetchAllRows: vi.fn() }));
vi.mock('../lib/supabase/batchWrite', () => ({ batchDelete: vi.fn(), batchUpdate: vi.fn() }));
vi.mock('../lib/activityLogger', () => ({ logActivity: vi.fn() }));

// Lookup tables are still plain selects: .from(t).select('name').order('name').
// Their writes are the fire-and-forget upsert/delete useLookupTable issues.
const db = vi.hoisted(() => ({
  /** Rows each lookup table returns on the initial fetch, keyed by table name. */
  lookupRows: {} as Record<string, { name: string }[]>,
  /** Row the next assets insert resolves with. */
  savedAsset: null as Record<string, unknown> | null,
  upserts: [] as { table: string; name: unknown }[],
  deletes: [] as { table: string; name: unknown }[],
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: () => ({
        order: () => Promise.resolve({ data: db.lookupRows[table] ?? [], error: null }),
      }),
      upsert: (payload: { name: string }) => {
        db.upserts.push({ table, name: payload.name });
        return Promise.resolve({ error: null });
      },
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: db.savedAsset, error: null }) }),
      }),
      delete: () => ({
        eq: (_column: string, value: unknown) => {
          db.deletes.push({ table, name: value });
          return Promise.resolve({ error: null });
        },
      }),
    })),
  },
}));

const dbRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  asset_number: `AN-${id}`,
  asset_description: `Asset ${id}`,
  asset_cost: 1000,
  status: 'Active',
  ...overrides,
});

/** A blank addAsset payload; overrides carry whatever the test is about. */
const assetInput = (
  overrides: Partial<Parameters<ReturnType<typeof useAsset>['addAsset']>[0]> = {},
) => ({
  assetBook: '',
  subsidiary: '',
  assetNumber: 'AN-new',
  assetDescription: 'Asset new',
  assetCost: '',
  datePlaceInService: '',
  assetUnits: '',
  categorySegment1: '',
  categorySegment2: '',
  depreciationMethod: '',
  lifeInMonths: '',
  listed: '',
  status: 'Active',
  verification: false,
  verificationDate: '',
  itemStatus: '',
  ...overrides,
});

let ctx: ReturnType<typeof useAsset>;

// The context value is published to `ctx` from an effect rather than during
// render: assigning to an outer variable mid-render is a side effect
// (react-hooks/globals), and the effect still runs before act() returns.
function Probe() {
  const value = useAsset();
  useEffect(() => {
    ctx = value;
  });
  return null;
}

async function renderProvider() {
  render(
    <AssetProvider>
      <Probe />
    </AssetProvider>,
  );
  await waitFor(() => expect(ctx.loading).toBe(false));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.lookupRows = {};
  db.savedAsset = null;
  db.upserts.length = 0;
  db.deletes.length = 0;
  vi.mocked(fetchAllRows).mockResolvedValue({ rows: [], error: null });
  vi.mocked(batchDelete).mockResolvedValue({ processed: 0, failed: 0, succeeded: 0 });
  vi.mocked(batchUpdate).mockResolvedValue({ processed: 0, failed: 0, succeeded: 0 });
});

describe('AssetContext — chunked fetch', () => {
  it('reads the assets table newest-first through fetchAllRows', async () => {
    await renderProvider();

    expect(fetchAllRows).toHaveBeenCalledWith('assets', {
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('maps every returned row into the assets list', async () => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: Array.from({ length: 2500 }, (_, i) => dbRow(String(i))),
      error: null,
    });

    await renderProvider();

    expect(ctx.assets).toHaveLength(2500);
    expect(ctx.assets[0].assetNumber).toBe('AN-0');
    expect(ctx.error).toBeNull();
  });

  it('surfaces a fetch error while still showing the rows that arrived', async () => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: [dbRow('a'), dbRow('b')],
      error: 'connection reset',
    });

    await renderProvider();

    expect(ctx.error).toBe('connection reset');
    expect(ctx.assets).toHaveLength(2);
  });

  it('derives lastFetchedAt from the newest updated_at across all rows', async () => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: [
        dbRow('a', { updated_at: '2026-01-01T00:00:00.000Z' }),
        dbRow('b', { updated_at: '2026-03-05T10:00:00.000Z' }),
        dbRow('c', {}),
      ],
      error: null,
    });

    await renderProvider();

    expect(ctx.lastFetchedAt?.toISOString()).toBe('2026-03-05T10:00:00.000Z');
  });

  it('leaves lastFetchedAt null when no row carries updated_at', async () => {
    vi.mocked(fetchAllRows).mockResolvedValue({ rows: [dbRow('a')], error: null });

    await renderProvider();

    expect(ctx.lastFetchedAt).toBeNull();
  });
});

describe('AssetContext — bulk delete', () => {
  beforeEach(() => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: [dbRow('a'), dbRow('b'), dbRow('c')],
      error: null,
    });
  });

  it('routes deleteMultipleAssets to the assets table with the ids given', async () => {
    await renderProvider();

    await act(async () => {
      await ctx.deleteMultipleAssets(['a', 'b']);
    });

    expect(batchDelete).toHaveBeenCalledWith('assets', ['a', 'b'], expect.any(Object));
  });

  it('forwards the caller onProgress untouched', async () => {
    const onProgress = vi.fn();
    vi.mocked(batchDelete).mockImplementation(async (_table, ids, options) => {
      options?.onProgress?.(ids.length, 0);
      return { processed: ids.length, failed: 0, succeeded: ids.length };
    });
    await renderProvider();

    await act(async () => {
      await ctx.deleteMultipleAssets(['a', 'b'], onProgress);
    });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(2, 0);
  });

  it('drops each cleanly deleted batch from local state', async () => {
    vi.mocked(batchDelete).mockImplementation(async (_table, ids, options) => {
      options?.onBatchDeleted?.(ids);
      return { processed: ids.length, failed: 0, succeeded: ids.length };
    });
    await renderProvider();

    await act(async () => {
      await ctx.deleteMultipleAssets(['a', 'c']);
    });

    expect(ctx.assets.map(a => a.id)).toEqual(['b']);
  });

  it('keeps local state intact when every batch fails', async () => {
    vi.mocked(batchDelete).mockResolvedValue({ processed: 2, failed: 2, succeeded: 0 });
    await renderProvider();

    await act(async () => {
      await ctx.deleteMultipleAssets(['a', 'b']);
    });

    expect(ctx.assets).toHaveLength(3);
  });

  it('deleteAllAssets passes every loaded asset id', async () => {
    await renderProvider();

    await act(async () => {
      await ctx.deleteAllAssets();
    });

    expect(batchDelete).toHaveBeenCalledWith('assets', ['a', 'b', 'c'], expect.any(Object));
  });
});

describe('AssetContext — bulk update', () => {
  beforeEach(() => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: [dbRow('a'), dbRow('b')],
      error: null,
    });
  });

  it('sends only the enabled fields as a db patch', async () => {
    await renderProvider();

    await act(async () => {
      await ctx.bulkUpdateAssets(['a'], { status: 'Broken' });
    });

    expect(batchUpdate).toHaveBeenCalledWith(
      'assets',
      ['a'],
      { status: 'Broken' },
      expect.any(Object),
    );
  });

  it('does not touch the database when the patch is empty', async () => {
    await renderProvider();

    let result;
    await act(async () => {
      result = await ctx.bulkUpdateAssets(['a'], {});
    });

    expect(batchUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: 0, failed: 0 });
  });

  it('does not touch the database when no rows are selected', async () => {
    await renderProvider();

    let result;
    await act(async () => {
      result = await ctx.bulkUpdateAssets([], { status: 'Broken' });
    });

    expect(batchUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: 0, failed: 0 });
  });

  it('reconciles returned rows into local state and reports the tallies', async () => {
    vi.mocked(batchUpdate).mockImplementation(async (_table, ids, _patch, options) => {
      options?.onBatchUpdated?.([dbRow('a', { status: 'Broken' })]);
      return { processed: ids.length, failed: 1, succeeded: 1 };
    });
    await renderProvider();

    let result;
    await act(async () => {
      result = await ctx.bulkUpdateAssets(['a', 'b'], { status: 'Broken' });
    });

    expect(result).toEqual({ updated: 1, failed: 1 });
    expect(ctx.assets.find(a => a.id === 'a')?.status).toBe('Broken');
    expect(ctx.assets.find(a => a.id === 'b')?.status).toBe('Active');
  });

  it('forwards onProgress with the caller-visible total', async () => {
    const onProgress = vi.fn();
    vi.mocked(batchUpdate).mockImplementation(async (_table, ids, _patch, options) => {
      options?.onProgress?.(ids.length, 0, ids.length);
      return { processed: ids.length, failed: 0, succeeded: ids.length };
    });
    await renderProvider();

    await act(async () => {
      await ctx.bulkUpdateAssets(['a', 'b'], { listed: 'Audited' }, onProgress);
    });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(2, 0, 2);
  });
});

describe('AssetContext — master data', () => {
  it('publishes each lookup table under its own name, deduped', async () => {
    db.lookupRows = {
      subsidiaries: [{ name: 'PT A' }, { name: 'PT B' }, { name: 'PT A' }],
      category_segments_1: [{ name: 'Vehicles' }],
      category_segments_2: [{ name: 'Jakarta' }],
      item_statuses: [{ name: 'Asset' }],
    };

    await renderProvider();

    expect(ctx.subsidiaries).toEqual(['PT A', 'PT B']);
    expect(ctx.categories1).toEqual(['Vehicles']);
    expect(ctx.categories2).toEqual(['Jakarta']);
    expect(ctx.itemStatuses).toEqual(['Asset']);
  });

  it('routes add and delete of each list to its own table', async () => {
    await renderProvider();

    act(() => {
      ctx.addSubsidiary('PT Baru');
      ctx.addCategory1('Machinery');
      ctx.addCategory2('Bandung');
      ctx.addItemStatus('Needs Review');
    });
    act(() => {
      ctx.deleteSubsidiary('PT Baru');
      ctx.deleteCategory1('Machinery');
      ctx.deleteCategory2('Bandung');
      ctx.deleteItemStatus('Needs Review');
    });

    expect(db.upserts).toEqual([
      { table: 'subsidiaries', name: 'PT Baru' },
      { table: 'category_segments_1', name: 'Machinery' },
      { table: 'category_segments_2', name: 'Bandung' },
      { table: 'item_statuses', name: 'Needs Review' },
    ]);
    expect(db.deletes).toEqual([
      { table: 'subsidiaries', name: 'PT Baru' },
      { table: 'category_segments_1', name: 'Machinery' },
      { table: 'category_segments_2', name: 'Bandung' },
      { table: 'item_statuses', name: 'Needs Review' },
    ]);
  });

  it('keeps the lists independent of one another', async () => {
    db.lookupRows = {
      subsidiaries: [{ name: 'PT A' }],
      category_segments_1: [{ name: 'Vehicles' }],
    };
    await renderProvider();

    act(() => ctx.deleteSubsidiary('PT A'));

    expect(ctx.subsidiaries).toEqual([]);
    expect(ctx.categories1).toEqual(['Vehicles']);
  });

  // The Step 4 gate, minus the browser: saving an asset with values that are not
  // in the lists yet must leave them selectable in the Autocompletes straight
  // away, with no refetch. Nothing in this path awaits the lookup writes.
  it('registers a new subsidiary, category and item status while saving an asset', async () => {
    db.savedAsset = dbRow('new');
    await renderProvider();

    await act(async () => {
      await ctx.addAsset(assetInput({
        subsidiary: 'PT Baru',
        categorySegment1: 'Machinery',
        categorySegment2: 'Bandung',
        itemStatus: 'Needs Review',
      }));
    });

    expect(ctx.subsidiaries).toContain('PT Baru');
    expect(ctx.categories1).toContain('Machinery');
    expect(ctx.categories2).toContain('Bandung');
    expect(ctx.itemStatuses).toContain('Needs Review');
    expect(ctx.assets.map(a => a.id)).toEqual(['new']);
  });

  it('leaves the lists alone for an asset whose lookup fields are blank', async () => {
    db.savedAsset = dbRow('new');
    await renderProvider();

    await act(async () => {
      await ctx.addAsset(assetInput());
    });

    expect(db.upserts).toEqual([]);
    expect(ctx.subsidiaries).toEqual([]);
  });
});

describe('AssetContext — modal state', () => {
  it('starts with both modals closed and nothing being edited', async () => {
    await renderProvider();

    expect(ctx.isAddModalOpen).toBe(false);
    expect(ctx.isEditModalOpen).toBe(false);
    expect(ctx.editingAsset).toBeNull();
  });

  it('opens the edit modal on a chosen asset without touching the add modal', async () => {
    vi.mocked(fetchAllRows).mockResolvedValue({ rows: [dbRow('a')], error: null });
    await renderProvider();

    act(() => {
      ctx.setEditingAsset(ctx.assets[0]);
      ctx.setIsEditModalOpen(true);
    });

    expect(ctx.editingAsset?.id).toBe('a');
    expect(ctx.isEditModalOpen).toBe(true);
    expect(ctx.isAddModalOpen).toBe(false);
  });

  it('opens the add modal without touching the edit modal', async () => {
    await renderProvider();

    act(() => ctx.setIsAddModalOpen(true));

    expect(ctx.isAddModalOpen).toBe(true);
    expect(ctx.isEditModalOpen).toBe(false);
    expect(ctx.editingAsset).toBeNull();
  });
});

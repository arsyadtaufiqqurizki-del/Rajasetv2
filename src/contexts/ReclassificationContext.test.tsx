import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { ReclassificationProvider, useReclassification } from './ReclassificationContext';
import { fetchAllRows } from '../lib/supabase/fetchAllRows';
import { batchDelete } from '../lib/supabase/batchWrite';

// Step 3 of "refactoring v2.md" — same wiring checks as AssetContext.test.tsx,
// with the extra thing this context must not lose: the embedded linked_asset
// join in its select expression, which is what keeps linked rows mirroring
// Asset Inventory instead of going stale.

vi.mock('../lib/supabase/fetchAllRows', () => ({ fetchAllRows: vi.fn() }));
vi.mock('../lib/supabase/batchWrite', () => ({ batchDelete: vi.fn(), batchUpdate: vi.fn() }));
vi.mock('../lib/activityLogger', () => ({ logActivity: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: null } }) } },
}));

const dbRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  asset_id: null,
  asset_description: `Item ${id}`,
  category: 'Needs Review',
  ...overrides,
});

let ctx: ReturnType<typeof useReclassification>;

// The context value is published to `ctx` from an effect rather than during
// render: assigning to an outer variable mid-render is a side effect
// (react-hooks/globals), and the effect still runs before act() returns.
function Probe() {
  const value = useReclassification();
  useEffect(() => {
    ctx = value;
  });
  return null;
}

async function renderProvider() {
  render(
    <ReclassificationProvider>
      <Probe />
    </ReclassificationProvider>,
  );
  await waitFor(() => expect(ctx.loading).toBe(false));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAllRows).mockResolvedValue({ rows: [], error: null });
  vi.mocked(batchDelete).mockResolvedValue({ processed: 0, failed: 0, succeeded: 0 });
});

describe('ReclassificationContext — chunked fetch', () => {
  it('reads its table newest-first, keeping the linked_asset join in the select', async () => {
    await renderProvider();

    expect(fetchAllRows).toHaveBeenCalledWith('asset_reclassifications', {
      select:
        '*, linked_asset:assets(asset_number, asset_description, category_segment1, category_segment2, subsidiary, asset_units)',
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('maps every returned row into the list', async () => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: Array.from({ length: 1500 }, (_, i) => dbRow(String(i))),
      error: null,
    });

    await renderProvider();

    expect(ctx.reclassifications).toHaveLength(1500);
    expect(ctx.reclassifications[0].assetDescription).toBe('Item 0');
  });

  it('surfaces a fetch error while still showing the rows that arrived', async () => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: [dbRow('a')],
      error: 'connection reset',
    });

    await renderProvider();

    expect(ctx.error).toBe('connection reset');
    expect(ctx.reclassifications).toHaveLength(1);
  });
});

describe('ReclassificationContext — bulk delete', () => {
  beforeEach(() => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: [dbRow('a'), dbRow('b'), dbRow('c')],
      error: null,
    });
  });

  it('routes deleteMultipleReclassifications to its own table', async () => {
    await renderProvider();

    await act(async () => {
      await ctx.deleteMultipleReclassifications(['a', 'b']);
    });

    expect(batchDelete).toHaveBeenCalledWith(
      'asset_reclassifications',
      ['a', 'b'],
      expect.any(Object),
    );
  });

  it('forwards the caller onProgress untouched', async () => {
    const onProgress = vi.fn();
    vi.mocked(batchDelete).mockImplementation(async (_table, ids, options) => {
      options?.onProgress?.(ids.length, 0);
      return { processed: ids.length, failed: 0, succeeded: ids.length };
    });
    await renderProvider();

    await act(async () => {
      await ctx.deleteMultipleReclassifications(['a', 'b'], onProgress);
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
      await ctx.deleteMultipleReclassifications(['b']);
    });

    expect(ctx.reclassifications.map(r => r.id)).toEqual(['a', 'c']);
  });

  it('keeps local state intact when every batch fails', async () => {
    vi.mocked(batchDelete).mockResolvedValue({ processed: 2, failed: 2, succeeded: 0 });
    await renderProvider();

    await act(async () => {
      await ctx.deleteMultipleReclassifications(['a', 'b']);
    });

    expect(ctx.reclassifications).toHaveLength(3);
  });

  it('deleteAllReclassifications passes every loaded id', async () => {
    await renderProvider();

    await act(async () => {
      await ctx.deleteAllReclassifications();
    });

    expect(batchDelete).toHaveBeenCalledWith(
      'asset_reclassifications',
      ['a', 'b', 'c'],
      expect.any(Object),
    );
  });
});

// Step 4 replaced the five hand-rolled modal useStates with useEntityModals
// (add + edit) and a useModalState for verify. This context is the only one with
// three modals, so what matters is that the third stays separate from the pair.
describe('ReclassificationContext — modal state', () => {
  beforeEach(() => {
    vi.mocked(fetchAllRows).mockResolvedValue({
      rows: [dbRow('a'), dbRow('b')],
      error: null,
    });
  });

  it('starts with all three modals closed and no row selected', async () => {
    await renderProvider();

    expect(ctx.isAddModalOpen).toBe(false);
    expect(ctx.isEditModalOpen).toBe(false);
    expect(ctx.isVerifyModalOpen).toBe(false);
    expect(ctx.editingReclassification).toBeNull();
    expect(ctx.verifyingReclassification).toBeNull();
  });

  it('keeps the edit row and the verify row apart', async () => {
    await renderProvider();

    act(() => {
      ctx.setEditingReclassification(ctx.reclassifications[0]);
      ctx.setVerifyingReclassification(ctx.reclassifications[1]);
    });

    expect(ctx.editingReclassification?.id).toBe('a');
    expect(ctx.verifyingReclassification?.id).toBe('b');
  });

  it('opening verify leaves add and edit closed', async () => {
    await renderProvider();

    act(() => {
      ctx.setVerifyingReclassification(ctx.reclassifications[0]);
      ctx.setIsVerifyModalOpen(true);
    });

    expect(ctx.isVerifyModalOpen).toBe(true);
    expect(ctx.isAddModalOpen).toBe(false);
    expect(ctx.isEditModalOpen).toBe(false);
  });

  it('opening add leaves edit and verify closed', async () => {
    await renderProvider();

    act(() => ctx.setIsAddModalOpen(true));

    expect(ctx.isAddModalOpen).toBe(true);
    expect(ctx.isEditModalOpen).toBe(false);
    expect(ctx.isVerifyModalOpen).toBe(false);
  });

  it('clearing the verify row does not clear the edit row', async () => {
    await renderProvider();

    act(() => {
      ctx.setEditingReclassification(ctx.reclassifications[0]);
      ctx.setVerifyingReclassification(ctx.reclassifications[1]);
    });
    act(() => ctx.setVerifyingReclassification(null));

    expect(ctx.verifyingReclassification).toBeNull();
    expect(ctx.editingReclassification?.id).toBe('a');
  });
});

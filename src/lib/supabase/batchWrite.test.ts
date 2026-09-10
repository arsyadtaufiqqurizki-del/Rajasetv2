import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchDelete, batchUpdate, WRITE_BATCH_SIZE } from './batchWrite';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({ supabase: { from: vi.fn() } }));

type Outcome = { data?: unknown[] | null; error: { message: string } | null };

interface Recorded {
  tables: string[];
  batches: string[][];
  patches: Record<string, unknown>[];
  /** Interleaved call order, so callback sequencing can be asserted. */
  log: string[];
}

/** Stands in for .delete().in('id', batch), one scripted outcome per batch. */
function mockDeletes(outcomes: Outcome[]): Recorded {
  const rec: Recorded = { tables: [], batches: [], patches: [], log: [] };
  let call = 0;

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    rec.tables.push(table);
    return {
      delete: () => ({
        in: (_column: string, batch: string[]) => {
          rec.batches.push(batch);
          rec.log.push(`request:${batch.length}`);
          return Promise.resolve(outcomes[call++] ?? { error: null });
        },
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);

  return rec;
}

/** Stands in for .update(patch).in('id', batch).select(). */
function mockUpdates(outcomes: Outcome[]): Recorded {
  const rec: Recorded = { tables: [], batches: [], patches: [], log: [] };
  let call = 0;

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    rec.tables.push(table);
    return {
      update: (patch: Record<string, unknown>) => {
        rec.patches.push(patch);
        return {
          in: (_column: string, batch: string[]) => {
            rec.batches.push(batch);
            rec.log.push(`request:${batch.length}`);
            return { select: () => Promise.resolve(outcomes[call++] ?? { data: [], error: null }) };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);

  return rec;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('batchDelete', () => {
  it('splits ids into batches of 100 and reports running totals', async () => {
    const rec = mockDeletes([]);
    const progress: Array<[number, number]> = [];

    const result = await batchDelete('assets', ids(250), {
      onProgress: (processed, failed) => progress.push([processed, failed]),
    });

    expect(rec.batches.map(b => b.length)).toEqual([100, 100, 50]);
    expect(progress).toEqual([
      [100, 0],
      [200, 0],
      [250, 0],
    ]);
    expect(result).toEqual({ processed: 250, failed: 0, succeeded: 250 });
    expect(WRITE_BATCH_SIZE).toBe(100);
  });

  it('counts a failing batch and keeps going with the rest', async () => {
    const rec = mockDeletes([{ error: null }, { error: { message: 'timeout' } }, { error: null }]);
    const deleted: string[][] = [];
    const progress: Array<[number, number]> = [];

    const result = await batchDelete('assets', ids(250), {
      onBatchDeleted: batch => deleted.push(batch),
      onProgress: (processed, failed) => progress.push([processed, failed]),
    });

    expect(rec.batches).toHaveLength(3);
    expect(deleted.map(b => b.length)).toEqual([100, 50]);
    expect(progress).toEqual([
      [100, 0],
      [200, 100],
      [250, 100],
    ]);
    expect(result).toEqual({ processed: 250, failed: 100, succeeded: 150 });
  });

  it('removes rows from local state before advancing the progress bar', async () => {
    const rec = mockDeletes([]);

    await batchDelete('assets', ids(150), {
      onBatchDeleted: batch => rec.log.push(`deleted:${batch.length}`),
      onProgress: processed => rec.log.push(`progress:${processed}`),
    });

    expect(rec.log).toEqual([
      'request:100',
      'deleted:100',
      'progress:100',
      'request:50',
      'deleted:50',
      'progress:150',
    ]);
  });

  it('issues no request and no progress for an empty id list', async () => {
    const rec = mockDeletes([]);
    const onProgress = vi.fn();

    const result = await batchDelete('assets', [], { onProgress });

    expect(rec.batches).toEqual([]);
    expect(onProgress).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, failed: 0, succeeded: 0 });
  });

  it('targets the table it was given', async () => {
    const rec = mockDeletes([]);

    await batchDelete('asset_reclassifications', ids(5));

    expect(rec.tables).toEqual(['asset_reclassifications']);
    expect(rec.batches).toEqual([ids(5)]);
  });

  it('honours a custom batch size', async () => {
    const rec = mockDeletes([]);

    await batchDelete('assets', ids(5), { batchSize: 2 });

    expect(rec.batches.map(b => b.length)).toEqual([2, 2, 1]);
  });
});

describe('batchUpdate', () => {
  it('applies the patch per batch and hands back the returned rows', async () => {
    const rec = mockUpdates([
      { data: [{ id: 'id-0' }], error: null },
      { data: [{ id: 'id-100' }], error: null },
    ]);
    const updated: unknown[][] = [];
    const progress: Array<[number, number, number]> = [];

    const result = await batchUpdate('assets', ids(150), { status: 'Active' }, {
      onBatchUpdated: rows => updated.push(rows),
      onProgress: (processed, failed, total) => progress.push([processed, failed, total]),
    });

    expect(rec.patches).toEqual([{ status: 'Active' }, { status: 'Active' }]);
    expect(rec.batches.map(b => b.length)).toEqual([100, 50]);
    expect(updated).toEqual([[{ id: 'id-0' }], [{ id: 'id-100' }]]);
    expect(progress).toEqual([
      [100, 0, 150],
      [150, 0, 150],
    ]);
    expect(result).toEqual({ processed: 150, failed: 0, succeeded: 150 });
  });

  it('counts a failing batch without reconciling its rows', async () => {
    mockUpdates([{ error: { message: 'permission denied' } }, { data: [], error: null }]);
    const onBatchUpdated = vi.fn();

    const result = await batchUpdate('assets', ids(150), { listed: 'Audited' }, { onBatchUpdated });

    expect(onBatchUpdated).toHaveBeenCalledTimes(1);
    expect(onBatchUpdated).toHaveBeenCalledWith([]);
    expect(result).toEqual({ processed: 150, failed: 100, succeeded: 50 });
  });

  it('issues no request for an empty id list', async () => {
    const rec = mockUpdates([]);

    const result = await batchUpdate('assets', [], { status: 'Active' });

    expect(rec.batches).toEqual([]);
    expect(result).toEqual({ processed: 0, failed: 0, succeeded: 0 });
  });
});

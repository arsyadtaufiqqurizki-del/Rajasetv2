import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllRows, FETCH_CHUNK_SIZE } from './fetchAllRows';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({ supabase: { from: vi.fn() } }));

type Page = { data: unknown[] | null; error: { message: string } | null };

interface Recorded {
  tables: string[];
  selects: string[];
  orders: Array<[string, { ascending: boolean }]>;
  ranges: Array<[number, number]>;
}

/**
 * Stands in for the PostgREST builder: .select().order?().range() where range
 * resolves to the next scripted page.
 */
function mockPages(pages: Page[]): Recorded {
  const rec: Recorded = { tables: [], selects: [], orders: [], ranges: [] };
  let call = 0;

  const builder = {
    order: (column: string, opts: { ascending: boolean }) => {
      rec.orders.push([column, opts]);
      return builder;
    },
    range: (from: number, to: number) => {
      rec.ranges.push([from, to]);
      return Promise.resolve(pages[call++] ?? { data: [], error: null });
    },
  };

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    rec.tables.push(table);
    return {
      select: (select: string) => {
        rec.selects.push(select);
        return builder;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);

  return rec;
}

const rows = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: `r${offset + i}` }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchAllRows', () => {
  it('returns a single short chunk without asking for a second one', async () => {
    const rec = mockPages([{ data: rows(3), error: null }]);

    const result = await fetchAllRows('assets');

    expect(result).toEqual({ rows: rows(3), error: null });
    expect(rec.ranges).toEqual([[0, 999]]);
  });

  it('keeps paging while chunks come back full, then stops on the short one', async () => {
    const rec = mockPages([
      { data: rows(FETCH_CHUNK_SIZE), error: null },
      { data: rows(FETCH_CHUNK_SIZE, FETCH_CHUNK_SIZE), error: null },
      { data: rows(7, 2 * FETCH_CHUNK_SIZE), error: null },
    ]);

    const result = await fetchAllRows('assets');

    expect(result.rows).toHaveLength(2 * FETCH_CHUNK_SIZE + 7);
    expect(result.error).toBeNull();
    expect(rec.ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('stops on an empty chunk when the row count is an exact multiple', async () => {
    const rec = mockPages([
      { data: rows(FETCH_CHUNK_SIZE), error: null },
      { data: [], error: null },
    ]);

    const result = await fetchAllRows('assets');

    expect(result.rows).toHaveLength(FETCH_CHUNK_SIZE);
    expect(rec.ranges).toHaveLength(2);
  });

  it('returns the chunks fetched so far alongside the error', async () => {
    const rec = mockPages([
      { data: rows(FETCH_CHUNK_SIZE), error: null },
      { data: null, error: { message: 'connection reset' } },
    ]);

    const result = await fetchAllRows('assets');

    expect(result.rows).toHaveLength(FETCH_CHUNK_SIZE);
    expect(result.error).toBe('connection reset');
    expect(rec.ranges).toHaveLength(2);
  });

  it('treats a null data payload as the end of the table', async () => {
    mockPages([{ data: null, error: null }]);

    const result = await fetchAllRows('assets');

    expect(result.rows).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("defaults the select to '*' and applies no ordering", async () => {
    const rec = mockPages([{ data: [], error: null }]);

    await fetchAllRows('assets');

    expect(rec.tables).toEqual(['assets']);
    expect(rec.selects).toEqual(['*']);
    expect(rec.orders).toEqual([]);
  });

  it('passes the select expression and ordering through on every chunk', async () => {
    const rec = mockPages([
      { data: rows(FETCH_CHUNK_SIZE), error: null },
      { data: rows(1, FETCH_CHUNK_SIZE), error: null },
    ]);

    await fetchAllRows('asset_reclassifications', {
      select: '*, linked_asset:assets(asset_number)',
      orderBy: { column: 'created_at', ascending: false },
    });

    expect(rec.tables).toEqual(['asset_reclassifications', 'asset_reclassifications']);
    expect(rec.selects).toEqual([
      '*, linked_asset:assets(asset_number)',
      '*, linked_asset:assets(asset_number)',
    ]);
    expect(rec.orders).toEqual([
      ['created_at', { ascending: false }],
      ['created_at', { ascending: false }],
    ]);
  });

  it('honours a custom chunk size', async () => {
    const rec = mockPages([
      { data: rows(2), error: null },
      { data: rows(1, 2), error: null },
    ]);

    const result = await fetchAllRows('assets', { chunkSize: 2 });

    expect(result.rows).toHaveLength(3);
    expect(rec.ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});

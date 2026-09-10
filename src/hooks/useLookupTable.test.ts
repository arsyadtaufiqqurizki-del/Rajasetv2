import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLookupTable } from './useLookupTable';

// Step 4 of "refactoring v2.md" folded four identical master-data blocks in
// AssetContext into this hook. What is pinned here is the optimistic contract:
// local state moves first, the request goes out after and is never awaited.

const calls = vi.hoisted(() => ({
  upserts: [] as { table: string; payload: unknown; options: unknown }[],
  deletes: [] as { table: string; column: string; value: unknown }[],
  /** When set, requests hang forever — used to prove writes are not awaited. */
  neverResolve: false,
  settle: () => (calls.neverResolve ? new Promise(() => {}) : Promise.resolve({ error: null })),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (payload: unknown, options: unknown) => {
        calls.upserts.push({ table, payload, options });
        return calls.settle();
      },
      delete: () => ({
        eq: (column: string, value: unknown) => {
          calls.deletes.push({ table, column, value });
          return calls.settle();
        },
      }),
    }),
  },
}));

beforeEach(() => {
  calls.upserts.length = 0;
  calls.deletes.length = 0;
  calls.neverResolve = false;
});

describe('useLookupTable — hydrate', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));
    expect(result.current.values).toEqual([]);
  });

  it('replaces the list with the names given', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));

    act(() => result.current.hydrate(['PT A', 'PT B']));
    expect(result.current.values).toEqual(['PT A', 'PT B']);

    act(() => result.current.hydrate(['PT C']));
    expect(result.current.values).toEqual(['PT C']);
  });

  it('dedupes, keeping first-seen order', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));

    act(() => result.current.hydrate(['PT B', 'PT A', 'PT B', 'PT A']));

    expect(result.current.values).toEqual(['PT B', 'PT A']);
  });

  it('issues no request — hydration is a read result, not a write', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));

    act(() => result.current.hydrate(['PT A']));

    expect(calls.upserts).toEqual([]);
    expect(calls.deletes).toEqual([]);
  });
});

describe('useLookupTable — add', () => {
  it('appends the name and upserts it on the table it was built for', () => {
    const { result } = renderHook(() => useLookupTable('category_segments_1'));

    act(() => result.current.add('Vehicles'));

    expect(result.current.values).toEqual(['Vehicles']);
    expect(calls.upserts).toEqual([
      {
        table: 'category_segments_1',
        payload: { name: 'Vehicles' },
        options: { onConflict: 'name' },
      },
    ]);
  });

  it('lists the name without waiting for the request to come back', () => {
    // AddAssetModal relies on this: a newly typed subsidiary must be selectable
    // in the Autocomplete the moment the modal closes. The upsert is
    // fire-and-forget, so a request still in flight must not hold the name back.
    calls.neverResolve = true;
    const { result } = renderHook(() => useLookupTable('subsidiaries'));

    act(() => result.current.add('PT Baru'));

    expect(result.current.values).toEqual(['PT Baru']);
    expect(calls.upserts).toHaveLength(1);
  });

  it('does not list a name twice, but still upserts it', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));
    act(() => result.current.hydrate(['PT A']));

    act(() => result.current.add('PT A'));

    expect(result.current.values).toEqual(['PT A']);
    // The upsert is idempotent and keeps the row alive even when the local list
    // came from a stale fetch — the pre-refactor code fired it too.
    expect(calls.upserts).toHaveLength(1);
  });

  it('ignores an empty name entirely', () => {
    const { result } = renderHook(() => useLookupTable('item_statuses'));

    act(() => result.current.add(''));

    expect(result.current.values).toEqual([]);
    expect(calls.upserts).toEqual([]);
  });

  it('appends to the end rather than re-sorting', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));
    act(() => result.current.hydrate(['PT B', 'PT C']));

    act(() => result.current.add('PT A'));

    expect(result.current.values).toEqual(['PT B', 'PT C', 'PT A']);
  });
});

describe('useLookupTable — remove', () => {
  it('drops the name and deletes it by name on the right table', () => {
    const { result } = renderHook(() => useLookupTable('category_segments_2'));
    act(() => result.current.hydrate(['Jakarta', 'Bandung']));

    act(() => result.current.remove('Jakarta'));

    expect(result.current.values).toEqual(['Bandung']);
    expect(calls.deletes).toEqual([
      { table: 'category_segments_2', column: 'name', value: 'Jakarta' },
    ]);
  });

  it('drops the name without waiting for the request to come back', () => {
    calls.neverResolve = true;
    const { result } = renderHook(() => useLookupTable('subsidiaries'));
    act(() => result.current.hydrate(['PT A', 'PT B']));

    act(() => result.current.remove('PT A'));

    expect(result.current.values).toEqual(['PT B']);
    expect(calls.deletes).toHaveLength(1);
  });

  it('leaves the other names untouched', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));
    act(() => result.current.hydrate(['PT A', 'PT B', 'PT C']));

    act(() => result.current.remove('PT B'));

    expect(result.current.values).toEqual(['PT A', 'PT C']);
  });

  it('still fires the delete for a name that is not listed locally', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));

    act(() => result.current.remove('PT Hantu'));

    expect(result.current.values).toEqual([]);
    expect(calls.deletes).toHaveLength(1);
  });

  it('does not guard against an empty name — the pre-refactor code did not either', () => {
    const { result } = renderHook(() => useLookupTable('subsidiaries'));

    act(() => result.current.remove(''));

    expect(calls.deletes).toEqual([{ table: 'subsidiaries', column: 'name', value: '' }]);
  });
});

describe('useLookupTable — identity', () => {
  it('keeps its callbacks stable across renders so callers can put them in deps', () => {
    const { result, rerender } = renderHook(() => useLookupTable('subsidiaries'));
    const first = { ...result.current };

    act(() => result.current.hydrate(['PT A']));
    rerender();

    expect(result.current.hydrate).toBe(first.hydrate);
    expect(result.current.add).toBe(first.add);
    expect(result.current.remove).toBe(first.remove);
  });

  it('gives each table its own independent list', () => {
    const { result } = renderHook(() => ({
      subs: useLookupTable('subsidiaries'),
      cats: useLookupTable('category_segments_1'),
    }));

    act(() => result.current.subs.add('PT A'));

    expect(result.current.subs.values).toEqual(['PT A']);
    expect(result.current.cats.values).toEqual([]);
    expect(calls.upserts.map(c => c.table)).toEqual(['subsidiaries']);
  });
});

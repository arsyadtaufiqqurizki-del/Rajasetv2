import { supabase } from '../supabase';

// Supabase caps a single select at 1000 rows. Every table that can outgrow that
// is read through this loop. The constant is part of the contract, not a tuning
// knob: changing it changes the request pattern against Supabase.
export const FETCH_CHUNK_SIZE = 1000;

export interface FetchAllRowsOptions {
  /** PostgREST select expression, including any embedded joins. Defaults to '*'. */
  select?: string;
  /** Applied before .range() so ordering is stable across chunks. */
  orderBy?: { column: string; ascending: boolean };
  chunkSize?: number;
}

export interface FetchAllRowsResult<T> {
  /**
   * Rows fetched so far. On error this holds the chunks that already succeeded —
   * callers render the partial set rather than blanking the list.
   */
  rows: T[];
  /** Message of the first failing chunk, or null when every chunk succeeded. */
  error: string | null;
}

/**
 * Reads an entire table in fixed-size chunks, stopping at the first short chunk
 * (or the first error). Mirrors the hand-rolled loops it replaced exactly: the
 * partial rows are kept, the error message is returned rather than thrown.
 */
export async function fetchAllRows<T = unknown>(
  table: string,
  options: FetchAllRowsOptions = {},
): Promise<FetchAllRowsResult<T>> {
  const { select = '*', orderBy, chunkSize = FETCH_CHUNK_SIZE } = options;

  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const base = supabase.from(table).select(select);
    const query = orderBy ? base.order(orderBy.column, { ascending: orderBy.ascending }) : base;
    const { data, error } = await query.range(from, from + chunkSize - 1);

    if (error) return { rows, error: error.message };

    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < chunkSize) break;
    from += chunkSize;
  }

  return { rows, error: null };
}

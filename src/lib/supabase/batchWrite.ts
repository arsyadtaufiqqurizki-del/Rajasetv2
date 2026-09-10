import { supabase } from '../supabase';

// Bulk writes go out 100 ids at a time. The progress bars in Inventory and
// Reclassification advance one step per batch, so this constant is also the
// granularity the user sees — keep it in sync with any UI that assumes it.
export const WRITE_BATCH_SIZE = 100;

export interface BatchWriteResult {
  /** Rows attempted, counted whether the batch succeeded or failed. */
  processed: number;
  /** Rows in batches that returned an error. */
  failed: number;
  /** Rows in batches that succeeded. */
  succeeded: number;
}

export interface BatchDeleteOptions {
  /** Called once per batch, after onBatchDeleted, with running totals. */
  onProgress?: (processed: number, failed: number) => void;
  /** Called with the ids of each batch that deleted cleanly, for optimistic state. */
  onBatchDeleted?: (ids: string[]) => void;
  batchSize?: number;
}

/**
 * Deletes rows by id in batches. A failing batch is counted and skipped, never
 * retried and never aborting the run — the caller decides what to do with the
 * failure count once every batch has been attempted.
 */
export async function batchDelete(
  table: string,
  ids: string[],
  options: BatchDeleteOptions = {},
): Promise<BatchWriteResult> {
  const { onProgress, onBatchDeleted, batchSize = WRITE_BATCH_SIZE } = options;

  let processed = 0;
  let failed = 0;
  let succeeded = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await supabase.from(table).delete().in('id', batch);

    if (error) {
      failed += batch.length;
    } else {
      succeeded += batch.length;
      onBatchDeleted?.(batch);
    }

    processed += batch.length;
    onProgress?.(processed, failed);
  }

  return { processed, failed, succeeded };
}

export interface BatchUpdateOptions<T> {
  /** Called once per batch, after onBatchUpdated, with running totals plus ids.length. */
  onProgress?: (processed: number, failed: number, total: number) => void;
  /** Called with the rows returned by each batch that updated cleanly. */
  onBatchUpdated?: (rows: T[]) => void;
  batchSize?: number;
}

/**
 * Applies one patch to rows by id in batches, returning the updated rows per
 * batch so callers can reconcile local state. Same failure policy as
 * {@link batchDelete}: count it, move on.
 */
export async function batchUpdate<T = unknown>(
  table: string,
  ids: string[],
  patch: Record<string, unknown>,
  options: BatchUpdateOptions<T> = {},
): Promise<BatchWriteResult> {
  const { onProgress, onBatchUpdated, batchSize = WRITE_BATCH_SIZE } = options;

  const total = ids.length;
  let processed = 0;
  let failed = 0;
  let succeeded = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { data, error } = await supabase.from(table).update(patch).in('id', batch).select();

    if (error) {
      failed += batch.length;
    } else {
      succeeded += batch.length;
      onBatchUpdated?.((data ?? []) as T[]);
    }

    processed += batch.length;
    onProgress?.(processed, failed, total);
  }

  return { processed, failed, succeeded };
}

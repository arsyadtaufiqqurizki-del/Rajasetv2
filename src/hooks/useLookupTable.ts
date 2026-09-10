import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * One master-data table of free-text names (subsidiaries, category segments,
 * item statuses). Every write is optimistic and fire-and-forget: the local list
 * is updated first, then the request goes out without being awaited.
 *
 * That ordering is load-bearing, not an accident — `addAsset` registers a newly
 * typed subsidiary/category/item status by calling `add()` and then saves the
 * asset, and the Autocomplete dropdowns must already show the new value when the
 * modal closes, without a refetch. Keep the state update before the request.
 */
export interface LookupTable {
  values: string[];
  /** Replaces the list with the deduped names from a fetch. */
  hydrate: (names: string[]) => void;
  /** Registers a name locally, then upserts it. Empty names are ignored. */
  add: (name: string) => void;
  /** Drops a name locally, then deletes it. */
  remove: (name: string) => void;
}

export function useLookupTable(table: string): LookupTable {
  const [values, setValues] = useState<string[]>([]);

  const hydrate = useCallback((names: string[]) => {
    setValues([...new Set(names)]);
  }, []);

  const add = useCallback(
    (name: string) => {
      if (!name) return;
      setValues(prev => (prev.includes(name) ? prev : [...prev, name]));
      supabase.from(table).upsert({ name }, { onConflict: 'name' }).then();
    },
    [table],
  );

  const remove = useCallback(
    (name: string) => {
      setValues(prev => prev.filter(v => v !== name));
      supabase.from(table).delete().eq('name', name).then();
    },
    [table],
  );

  return { values, hydrate, add, remove };
}

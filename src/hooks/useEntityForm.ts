import React, { useCallback, useState } from 'react';

/**
 * Form state for an entity modal: the field values plus the transient save state
 * (spinner + error banner) that every Add/Edit pair in this app carries.
 *
 * Lifted out of AddAssetModal and EditAssetModal in Step 6 of "refactoring v2.md",
 * where the pair held six copies of the same three pieces of state and two copies
 * of the same try/catch around the context call.
 *
 * The values are typed as strings throughout: an entity form is a bag of text
 * inputs, and the conversions to the shape the database wants (a boolean here, a
 * comma-stripped number there) happen once, on save, at the call site.
 */
export interface EntityForm<T extends Record<string, string>> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  /** Writes one field, keyed by the input's `name`. */
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  isSaving: boolean;
  saveError: string | null;
  /**
   * Wraps the caller's save routine: swallows the default submit, clears the
   * banner, raises `isSaving`, and turns a rejection into `${errorPrefix}: ...`.
   * The caller closes its own modal inside `save` — the hook owns no modal state.
   */
  handleSubmit: (save: (values: T) => Promise<void>) => (e: React.FormEvent) => Promise<void>;
}

export interface EntityFormOptions<T extends Record<string, string>> {
  /** Values the form starts from when `seed` has nothing to offer. */
  initialValues: T;
  /**
   * Whenever this value changes, `isSaving` and `saveError` are cleared and the
   * fields are re-seeded. Add passes its open flag; Edit passes the row being edited.
   */
  resetKey: unknown;
  /**
   * Values for a re-seed. Returning `null` leaves the fields as the user left them —
   * which is what AddAssetModal does when it is closed and reopened. Also called
   * once on mount, so a row that is already selected hydrates in the first render
   * rather than a frame later.
   */
  seed?: () => T | null;
  /** Prefix of the error banner, e.g. `'Failed to save asset'`. */
  errorPrefix: string;
}

export function useEntityForm<T extends Record<string, string>>({
  initialValues,
  resetKey,
  seed,
  errorPrefix,
}: EntityFormOptions<T>): EntityForm<T> {
  const [values, setValues] = useState<T>(() => seed?.() ?? initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Re-seeding during render rather than from an effect: React re-runs the
  // component before committing, so the fields never paint one frame of stale
  // values — and the hook stays clear of `react-hooks/set-state-in-effect`.
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setIsSaving(false);
    setSaveError(null);
    const seeded = seed?.();
    if (seeded != null) setValues(seeded);
  }

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = (save: (values: T) => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setIsSaving(true);
    try {
      await save(values);
    } catch (err) {
      setSaveError(
        `${errorPrefix}: ` + (err instanceof Error ? err.message : 'An unexpected error occurred.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return { values, setValues, handleChange, isSaving, saveError, handleSubmit };
}

import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEntityForm } from './useEntityForm';

// Step 6 of "refactoring v2.md" pulled the form-state trio (values, isSaving,
// saveError) plus the try/catch around the context call out of AddAssetModal and
// EditAssetModal. Two behaviours here are load-bearing and easy to lose:
//   * a reset with no seed leaves the fields alone — that is how Add keeps what
//     the user typed when the modal is closed and reopened;
//   * the seed also runs on mount, so Edit hydrates in the first render instead
//     of a frame later (the old code hydrated from an effect).

type Values = { name: string; note: string };

const BLANK: Values = { name: '', note: '' };

/** A change event with just the two fields handleChange reads. */
function changeEvent(name: string, value: string) {
  return { target: { name, value } } as React.ChangeEvent<HTMLInputElement>;
}

const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as React.FormEvent;

describe('useEntityForm — initial values', () => {
  it('starts from initialValues when there is no seed', () => {
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed' }),
    );

    expect(result.current.values).toEqual(BLANK);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.saveError).toBeNull();
  });

  it('starts from the seed when one is given, without waiting for an effect', () => {
    const { result } = renderHook(() =>
      useEntityForm({
        initialValues: BLANK,
        resetKey: 'row-1',
        seed: () => ({ name: 'Ada', note: 'hydrated' }),
        errorPrefix: 'Failed',
      }),
    );

    expect(result.current.values).toEqual({ name: 'Ada', note: 'hydrated' });
  });

  it('falls back to initialValues when the seed has nothing yet', () => {
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: null, seed: () => null, errorPrefix: 'Failed' }),
    );

    expect(result.current.values).toEqual(BLANK);
  });
});

describe('useEntityForm — handleChange', () => {
  it('writes the field named by the input', () => {
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed' }),
    );

    act(() => result.current.handleChange(changeEvent('name', 'Ada')));
    expect(result.current.values).toEqual({ name: 'Ada', note: '' });

    act(() => result.current.handleChange(changeEvent('note', 'hello')));
    expect(result.current.values).toEqual({ name: 'Ada', note: 'hello' });
  });

  it('keeps the same identity across renders', () => {
    const { result, rerender } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed' }),
    );

    const first = result.current.handleChange;
    rerender();
    expect(result.current.handleChange).toBe(first);
  });
});

describe('useEntityForm — resetKey', () => {
  it('leaves the values alone when there is no seed', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useEntityForm({ initialValues: BLANK, resetKey: open, errorPrefix: 'Failed' }),
      { initialProps: { open: true } },
    );

    act(() => result.current.handleChange(changeEvent('name', 'half typed')));

    rerender({ open: false });
    rerender({ open: true });

    expect(result.current.values).toEqual({ name: 'half typed', note: '' });
  });

  it('re-seeds the values when the seed provides some', () => {
    let row = { name: 'Ada', note: 'first' };
    const { result, rerender } = renderHook(
      ({ key }) =>
        useEntityForm({ initialValues: BLANK, resetKey: key, seed: () => row, errorPrefix: 'Failed' }),
      { initialProps: { key: 'row-1' } },
    );

    act(() => result.current.handleChange(changeEvent('note', 'edited')));
    expect(result.current.values.note).toBe('edited');

    row = { name: 'Grace', note: 'second' };
    rerender({ key: 'row-2' });

    expect(result.current.values).toEqual({ name: 'Grace', note: 'second' });
  });

  it('clears a stale error banner', async () => {
    const { result, rerender } = renderHook(
      ({ open }) => useEntityForm({ initialValues: BLANK, resetKey: open, errorPrefix: 'Failed' }),
      { initialProps: { open: true } },
    );

    await act(() =>
      result.current.handleSubmit(() => Promise.reject(new Error('nope')))(submitEvent()),
    );
    expect(result.current.saveError).toBe('Failed: nope');

    rerender({ open: false });
    expect(result.current.saveError).toBeNull();
  });

  it('does not reset while the key stays the same', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useEntityForm({ initialValues: BLANK, resetKey: open, errorPrefix: 'Failed' }),
      { initialProps: { open: true } },
    );

    act(() => result.current.handleChange(changeEvent('name', 'Ada')));
    rerender({ open: true });

    expect(result.current.values.name).toBe('Ada');
  });
});

describe('useEntityForm — handleSubmit', () => {
  it('suppresses the browser submit and hands the current values to the save routine', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const event = submitEvent();
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed' }),
    );

    act(() => result.current.handleChange(changeEvent('name', 'Ada')));
    await act(() => result.current.handleSubmit(save)(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith({ name: 'Ada', note: '' });
    expect(result.current.saveError).toBeNull();
    expect(result.current.isSaving).toBe(false);
  });

  it('raises isSaving for the duration of the save', async () => {
    let release: () => void = () => {};
    const save = () => new Promise<void>(resolve => { release = resolve; });
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed' }),
    );

    let submitted: Promise<void>;
    act(() => { submitted = result.current.handleSubmit(save)(submitEvent()); });
    expect(result.current.isSaving).toBe(true);

    await act(async () => { release(); await submitted; });
    expect(result.current.isSaving).toBe(false);
  });

  it('prefixes an Error message with errorPrefix', async () => {
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed to save asset' }),
    );

    await act(() =>
      result.current.handleSubmit(() => Promise.reject(new Error('duplicate key value')))(submitEvent()),
    );

    expect(result.current.saveError).toBe('Failed to save asset: duplicate key value');
    expect(result.current.isSaving).toBe(false);
  });

  it('falls back to a generic message when the rejection is not an Error', async () => {
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed to update asset' }),
    );

    await act(() => result.current.handleSubmit(() => Promise.reject('boom'))(submitEvent()));

    expect(result.current.saveError).toBe('Failed to update asset: An unexpected error occurred.');
  });

  it('clears the previous banner when the next save succeeds', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed' }),
    );

    await act(() => result.current.handleSubmit(save)(submitEvent()));
    expect(result.current.saveError).toBe('Failed: network down');

    await act(() => result.current.handleSubmit(save)(submitEvent()));
    expect(result.current.saveError).toBeNull();
  });

  it('leaves the values in place after a failed save so the user can retry', async () => {
    const { result } = renderHook(() =>
      useEntityForm({ initialValues: BLANK, resetKey: true, errorPrefix: 'Failed' }),
    );

    act(() => result.current.handleChange(changeEvent('name', 'Ada')));
    await act(() => result.current.handleSubmit(() => Promise.reject(new Error('nope')))(submitEvent()));

    expect(result.current.values.name).toBe('Ada');
  });
});

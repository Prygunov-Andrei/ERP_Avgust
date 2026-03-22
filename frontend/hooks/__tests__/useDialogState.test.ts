import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialogState } from '../useDialogState';

describe('useDialogState', () => {
  it('starts closed with no data', () => {
    const { result } = renderHook(() => useDialogState<string>());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('opens without data', () => {
    const { result } = renderHook(() => useDialogState());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('opens with data', () => {
    const { result } = renderHook(() => useDialogState<{ id: number; name: string }>());

    act(() => {
      result.current.open({ id: 42, name: 'test' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ id: 42, name: 'test' });
  });

  it('closes and clears data', () => {
    const { result } = renderHook(() => useDialogState<string>());

    act(() => {
      result.current.open('hello');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe('hello');

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('replaces data on re-open', () => {
    const { result } = renderHook(() => useDialogState<number>());

    act(() => {
      result.current.open(1);
    });
    expect(result.current.data).toBe(1);

    act(() => {
      result.current.close();
    });

    act(() => {
      result.current.open(2);
    });
    expect(result.current.data).toBe(2);
  });
});

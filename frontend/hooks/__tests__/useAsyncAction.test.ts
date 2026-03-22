import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncAction } from '../useAsyncAction';

// Мокаем sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAsyncAction', () => {
  it('starts with isLoading=false and error=null', () => {
    const { result } = renderHook(() => useAsyncAction());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets isLoading during execution', async () => {
    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    const { result } = renderHook(() => useAsyncAction<string>());

    let executePromise: Promise<string | undefined>;
    act(() => {
      executePromise = result.current.execute(() => promise);
    });

    // Во время выполнения isLoading === true
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!('done');
      await executePromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('returns result on success', async () => {
    const { result } = renderHook(() => useAsyncAction<number>());

    let returned: number | undefined;
    await act(async () => {
      returned = await result.current.execute(() => Promise.resolve(42));
    });

    expect(returned).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('shows success toast when successMessage provided', async () => {
    const { result } = renderHook(() =>
      useAsyncAction({ successMessage: 'Saved!' }),
    );

    await act(async () => {
      await result.current.execute(() => Promise.resolve());
    });

    expect(toastSuccess).toHaveBeenCalledWith('Saved!');
  });

  it('does not show success toast when no successMessage', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.execute(() => Promise.resolve());
    });

    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('calls onSuccess callback with result', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useAsyncAction<string>({ onSuccess }),
    );

    await act(async () => {
      await result.current.execute(() => Promise.resolve('data'));
    });

    expect(onSuccess).toHaveBeenCalledWith('data');
  });

  it('handles error and sets error state', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.execute(() =>
        Promise.reject(new Error('Network failure')),
      );
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network failure');
    expect(result.current.isLoading).toBe(false);
  });

  it('shows error toast with error message by default', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.execute(() =>
        Promise.reject(new Error('Something went wrong')),
      );
    });

    expect(toastError).toHaveBeenCalledWith('Something went wrong');
  });

  it('shows custom error toast when errorMessage provided', async () => {
    const { result } = renderHook(() =>
      useAsyncAction({ errorMessage: 'Custom error' }),
    );

    await act(async () => {
      await result.current.execute(() =>
        Promise.reject(new Error('original')),
      );
    });

    expect(toastError).toHaveBeenCalledWith('Custom error');
  });

  it('calls onError callback on failure', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useAsyncAction({ onError }));

    await act(async () => {
      await result.current.execute(() =>
        Promise.reject(new Error('fail')),
      );
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('fail');
  });

  it('returns undefined on error', async () => {
    const { result } = renderHook(() => useAsyncAction<string>());

    let returned: string | undefined;
    await act(async () => {
      returned = await result.current.execute(() =>
        Promise.reject(new Error('fail')),
      );
    });

    expect(returned).toBeUndefined();
  });

  it('clears previous error on new execute', async () => {
    const { result } = renderHook(() => useAsyncAction<string>());

    // Первый вызов — ошибка
    await act(async () => {
      await result.current.execute(() =>
        Promise.reject(new Error('first error')),
      );
    });
    expect(result.current.error?.message).toBe('first error');

    // Второй вызов — успех
    await act(async () => {
      await result.current.execute(() => Promise.resolve('ok'));
    });
    expect(result.current.error).toBeNull();
  });

  it('handles non-Error thrown values', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.execute(() => Promise.reject('string error'));
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });
});

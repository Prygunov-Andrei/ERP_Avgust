import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UseAsyncActionOptions<T> {
  /** Сообщение при успехе (показывается через toast.success) */
  successMessage?: string;
  /** Сообщение при ошибке (показывается через toast.error, по умолчанию берётся из Error.message) */
  errorMessage?: string;
  /** Колбэк после успешного выполнения */
  onSuccess?: (result: T) => void;
  /** Колбэк при ошибке */
  onError?: (error: Error) => void;
}

interface UseAsyncActionReturn<T> {
  /** Выполнить асинхронное действие */
  execute: (fn: () => Promise<T>) => Promise<T | undefined>;
  /** Идёт ли выполнение */
  isLoading: boolean;
  /** Последняя ошибка (сбрасывается при новом вызове execute) */
  error: Error | null;
}

/**
 * Хук для унификации паттерна: loading state + try/catch/finally + toast.
 *
 * Заменяет 40+ повторений:
 * ```
 * const [loading, setLoading] = useState(false);
 * try { setLoading(true); await action(); toast.success(...); }
 * catch (e) { toast.error(...); }
 * finally { setLoading(false); }
 * ```
 *
 * Использование:
 * ```
 * const { execute, isLoading } = useAsyncAction({ successMessage: 'Сохранено' });
 * await execute(() => api.save(data));
 * ```
 */
export function useAsyncAction<T = void>(
  options?: UseAsyncActionOptions<T>,
): UseAsyncActionReturn<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Храним options в ref, чтобы execute не пересоздавался при смене options
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | undefined> => {
      const opts = optionsRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const result = await fn();

        if (opts?.successMessage) {
          toast.success(opts.successMessage);
        }
        opts?.onSuccess?.(result);

        return result;
      } catch (err) {
        const resolvedError =
          err instanceof Error ? err : new Error(String(err));
        setError(resolvedError);

        const message = opts?.errorMessage ?? resolvedError.message;
        toast.error(message);

        opts?.onError?.(resolvedError);

        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { execute, isLoading, error };
}

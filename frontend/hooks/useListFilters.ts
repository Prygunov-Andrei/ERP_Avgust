import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

interface UseListFiltersOptions {
  /** Задержка debounce для поиска (мс, по умолчанию 300) */
  debounceMs?: number;
}

interface UseListFiltersReturn<F extends Record<string, string>> {
  /** Текущее значение поискового поля (обновляется сразу при вводе) */
  search: string;
  /** Значение поиска после debounce (для отправки в API) */
  debouncedSearch: string;
  /** Текущие фильтры */
  filters: F;
  /** Текущая страница (начинается с 1) */
  page: number;
  /** Установить значение поиска */
  setSearch: (value: string) => void;
  /** Обновить один фильтр по ключу (сбрасывает страницу на 1) */
  setFilter: <K extends keyof F>(key: K, value: F[K]) => void;
  /** Сбросить все фильтры и поиск к начальным значениям */
  resetFilters: () => void;
  /** Установить страницу */
  setPage: (page: number) => void;
}

/**
 * Хук для управления поиском, фильтрами и пагинацией списка.
 *
 * Использование:
 * ```
 * const { search, debouncedSearch, filters, page, setSearch, setFilter, setPage, resetFilters } =
 *   useListFilters({ status: '', type: '' }, { debounceMs: 300 });
 * ```
 */
export function useListFilters<F extends Record<string, string>>(
  initialFilters: F,
  options?: UseListFiltersOptions,
): UseListFiltersReturn<F> {
  const debounceMs = options?.debounceMs ?? 300;

  const [search, setSearchRaw] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<F>(initialFilters);
  const [page, setPageRaw] = useState(1);

  // Запоминаем начальные фильтры для reset
  const initialFiltersRef = useRef(initialFilters);

  // Debounce для поиска
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPageRaw(1);
  }, []);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageRaw(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchRaw('');
    setDebouncedSearch('');
    setFilters(initialFiltersRef.current);
    setPageRaw(1);
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageRaw(newPage);
  }, []);

  return useMemo(
    () => ({
      search,
      debouncedSearch,
      filters,
      page,
      setSearch,
      setFilter,
      resetFilters,
      setPage,
    }),
    [search, debouncedSearch, filters, page, setSearch, setFilter, resetFilters, setPage],
  );
}

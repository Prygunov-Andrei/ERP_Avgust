export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Generic entity with id and name — used for select dropdowns */
export interface NamedEntity {
  id: number;
  name: string;
  [key: string]: unknown;
}

/** Unwrap paginated or array API response to a flat array */
export function unwrapResults<T>(data: T[] | PaginatedResponse<T> | { results: T[]; count: number } | { results: T[] } | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if ('results' in data) return data.results;
  return [];
}

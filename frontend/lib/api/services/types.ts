/**
 * Shared type for the bound request function passed to each domain service.
 */
export type RequestFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

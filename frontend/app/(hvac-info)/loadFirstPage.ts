import type { getNews } from '@/lib/hvac-api';

type NewsPage = Awaited<ReturnType<typeof getNews>>;

export interface LoadFirstPageResult {
  page: NewsPage;
  empty: boolean;
  lastError: unknown;
}

export interface LoadFirstPageOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const EMPTY_PAGE: NewsPage = {
  results: [],
  count: 0,
  next: null,
  previous: null,
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function loadFirstPage(
  fetcher: () => Promise<NewsPage>,
  opts: LoadFirstPageOptions = {},
): Promise<LoadFirstPageResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 1000;
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: unknown = null;
  let lastPage: NewsPage | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const page = await fetcher();
      lastPage = page;
      if (page.results && page.results.length > 0) {
        return { page, empty: false, lastError: null };
      }
    } catch (e) {
      lastError = e;
      console.error(`[news-feed] getNews attempt ${attempt}/${maxAttempts} failed:`, e);
    }
    if (attempt < maxAttempts) {
      await sleep(retryDelayMs);
    }
  }

  return {
    page: lastPage ?? EMPTY_PAGE,
    empty: true,
    lastError,
  };
}

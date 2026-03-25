/**
 * Серверный API-клиент для HVAC через unified backend namespace.
 * Используется в Server Components для SSR.
 */

import type {
  HvacBrand as Brand,
  HvacManufacturer as Manufacturer,
  HvacManufacturerRef as ManufacturerRef,
  HvacNews as NewsItem,
  HvacNewsMedia as NewsMedia,
  HvacPaginatedResponse as PaginatedResponse,
  HvacResource as Resource,
} from '@/lib/api/types/hvac';

export type {
  Brand,
  Manufacturer,
  ManufacturerRef,
  NewsItem,
  NewsMedia,
  Resource,
};

const BACKEND_API_URL = (process.env.BACKEND_API_URL || 'http://backend:8000').replace(/\/$/, '');

type CollectionResponse<T> = T[] | PaginatedResponse<T>;

async function fetchApi<T>(endpoint: string, options?: { revalidate?: number }): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BACKEND_API_URL}/api/v1/hvac/public${normalizedEndpoint}`;
  const res = await fetch(url, {
    next: { revalidate: options?.revalidate ?? 300 },
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`HVAC API error: ${res.status} ${res.statusText} for ${url}`);
  }

  return res.json();
}

function unwrapCollectionResponse<T>(response: CollectionResponse<T>): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response.results;
}

// --- Публичные методы ---

export async function getNews(page = 1): Promise<PaginatedResponse<NewsItem>> {
  return fetchApi(`/news/?page=${page}`, { revalidate: 300 });
}

export async function getNewsById(id: number): Promise<NewsItem> {
  return fetchApi(`/news/${id}/`, { revalidate: 600 });
}

export async function getAllNews(): Promise<NewsItem[]> {
  // Для sitemap/RSS — получаем все новости
  const items: NewsItem[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const data = await fetchApi<PaginatedResponse<NewsItem>>(`/news/?page=${page}&page_size=100`, { revalidate: 3600 });
    items.push(...data.results);
    hasNext = !!data.next;
    page++;
  }

  return items;
}

export async function getManufacturers(): Promise<Manufacturer[]> {
  const response = await fetchApi<CollectionResponse<Manufacturer>>('/references/manufacturers/', { revalidate: 3600 });
  return unwrapCollectionResponse(response);
}

export async function getBrands(): Promise<Brand[]> {
  const response = await fetchApi<CollectionResponse<Brand>>('/references/brands/', { revalidate: 3600 });
  return unwrapCollectionResponse(response);
}

export async function getResources(): Promise<Resource[]> {
  const response = await fetchApi<CollectionResponse<Resource>>('/references/resources/', { revalidate: 3600 });
  return unwrapCollectionResponse(response);
}

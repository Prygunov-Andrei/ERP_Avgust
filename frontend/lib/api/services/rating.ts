import type {
  RatingModelListItem,
  RatingModelDetail,
  RatingMethodology,
} from '../types/rating';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

async function ratingFetch<T>(path: string): Promise<T> {
  const url = `${BASE}/api/public/v1/rating${path}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Rating API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export function getRatingModels(): Promise<RatingModelListItem[]> {
  return ratingFetch<RatingModelListItem[]>('/models/');
}

export function getRatingModelBySlug(slug: string): Promise<RatingModelDetail> {
  return ratingFetch<RatingModelDetail>(`/models/by-slug/${slug}/`);
}

export function getRatingMethodology(): Promise<RatingMethodology> {
  return ratingFetch<RatingMethodology>('/methodology/');
}

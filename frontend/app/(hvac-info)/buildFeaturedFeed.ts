import type { HvacNews as NewsItem } from '@/lib/api/types/hvac';

export interface FeaturedFeed {
  hero: NewsItem[];
  feed: NewsItem[];
}

/**
 * Собирает массивы для NewsFeedHero и NewsFeedList с учётом featured-новости.
 *
 * - hero[0] = featured (если есть) или items[0] (fallback).
 * - hero[1..4] = ближайшие следующие новости для sidebar (без дубля featured).
 * - feed = featured (если есть) + остальные items без дубля. NewsFeedList
 *   сам отрежет первые 5 через skipFirst=5 (соответствует hero+sidebar).
 *
 * Если featured=null — возвращаем items как есть (поведение до Эпика H).
 */
export function buildFeaturedFeed(
  items: NewsItem[],
  featuredPost: NewsItem | null,
): FeaturedFeed {
  if (!featuredPost) {
    return { hero: items, feed: items };
  }
  const dedup = items.filter((n) => n.id !== featuredPost.id);
  return {
    hero: [featuredPost, ...dedup.slice(0, 4)],
    feed: [featuredPost, ...dedup],
  };
}

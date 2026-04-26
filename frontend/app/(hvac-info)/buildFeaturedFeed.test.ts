import { describe, expect, it } from 'vitest';
import type { HvacNews } from '@/lib/api/types/hvac';
import { buildFeaturedFeed } from './buildFeaturedFeed';

const mk = (id: number, partial: Partial<HvacNews> = {}): HvacNews => ({
  id,
  title: `Новость №${id}`,
  body: '',
  pub_date: '2026-04-21T10:00:00Z',
  category: 'industry',
  ...partial,
});

describe('buildFeaturedFeed', () => {
  it('featured=null → возвращает items как есть для hero и feed (fallback)', () => {
    const items = [mk(1), mk(2), mk(3)];
    const { hero, feed } = buildFeaturedFeed(items, null);
    expect(hero).toEqual(items);
    expect(feed).toEqual(items);
  });

  it('featured=null + items=[] → пустой hero (NewsFeedHero вернёт null)', () => {
    const { hero, feed } = buildFeaturedFeed([], null);
    expect(hero).toEqual([]);
    expect(feed).toEqual([]);
  });

  it('featured уже первый элемент items → результат идентичен исходному (нет дублей)', () => {
    const items = [mk(1), mk(2), mk(3), mk(4), mk(5), mk(6)];
    const { hero, feed } = buildFeaturedFeed(items, items[0]);
    expect(hero.map((n) => n.id)).toEqual([1, 2, 3, 4, 5]);
    expect(feed.map((n) => n.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('featured где-то в середине items → выносится в hero[0], дедуп в остальных', () => {
    const items = [mk(1), mk(2), mk(3), mk(4), mk(5), mk(6)];
    const featured = items[3]; // id=4
    const { hero, feed } = buildFeaturedFeed(items, featured);
    expect(hero.map((n) => n.id)).toEqual([4, 1, 2, 3, 5]);
    expect(feed.map((n) => n.id)).toEqual([4, 1, 2, 3, 5, 6]);
    // id=4 встречается ровно один раз
    expect(feed.filter((n) => n.id === 4)).toHaveLength(1);
  });

  it('featured вне items → добавляется в начало hero и feed', () => {
    const items = [mk(1), mk(2), mk(3)];
    const featured = mk(99);
    const { hero, feed } = buildFeaturedFeed(items, featured);
    expect(hero.map((n) => n.id)).toEqual([99, 1, 2, 3]);
    expect(feed.map((n) => n.id)).toEqual([99, 1, 2, 3]);
  });

  it('featured + items=[] → hero и feed состоят только из featured', () => {
    const featured = mk(7);
    const { hero, feed } = buildFeaturedFeed([], featured);
    expect(hero).toEqual([featured]);
    expect(feed).toEqual([featured]);
  });

  it('hero ограничивается 5 элементами (1 featured + 4 sidebar) даже при больших items', () => {
    const items = Array.from({ length: 20 }, (_, i) => mk(i + 1));
    const featured = mk(100);
    const { hero, feed } = buildFeaturedFeed(items, featured);
    expect(hero).toHaveLength(5);
    expect(hero[0].id).toBe(100);
    expect(feed).toHaveLength(21);
  });
});

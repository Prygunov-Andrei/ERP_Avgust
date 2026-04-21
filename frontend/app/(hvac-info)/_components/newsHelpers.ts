import type { HvacNews as NewsItem } from '@/lib/api/types/hvac';

export const NEWS_CATEGORIES: Array<{ code: string; label: string }> = [
  { code: 'all', label: 'Все' },
  { code: 'business', label: 'Деловые' },
  { code: 'industry', label: 'Индустрия' },
  { code: 'market', label: 'Рынок' },
  { code: 'regulation', label: 'Регулирование' },
  { code: 'review', label: 'Обзор' },
  { code: 'guide', label: 'Гайд' },
  { code: 'brands', label: 'Бренды' },
];

export function formatNewsDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function formatNewsDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

/**
 * Возвращает первое media-image из новости, либо null.
 */
export function getNewsHeroImage(news: NewsItem): string | null {
  const file = news.media?.find((m) => (m.media_type ?? 'image') === 'image')?.file;
  return file ?? null;
}

/**
 * Лид — предпочтительно поле lede (M5), иначе первые 200 символов body без HTML.
 */
export function getNewsLede(news: NewsItem, maxChars = 200): string {
  if (news.lede && news.lede.trim()) return news.lede.trim();
  const plain = (news.body || '').replace(/<[^>]*>/g, '').trim();
  if (plain.length <= maxChars) return plain;
  return plain.slice(0, maxChars).trimEnd() + '…';
}

/**
 * Категория для отображения: category_display || category || 'Новости' (fallback).
 */
export function getNewsCategoryLabel(news: NewsItem): string {
  return (news.category_display || news.category || 'Новости').toString();
}

/**
 * Вычисляет соседей в ленте для страницы деталей.
 */
export function prevNextFromIndex<T extends { id: number }>(
  all: T[],
  currentId: number,
): { prev: T | null; next: T | null } {
  const idx = all.findIndex((n) => n.id === currentId);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

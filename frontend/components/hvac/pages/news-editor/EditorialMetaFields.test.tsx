import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditorialMetaFields, { LEDE_SOFT_MAX } from './EditorialMetaFields';
import type { HvacNewsCategory, HvacNewsCategoryItem } from '@/lib/api/types/hvac';

// Wave 9: список категорий грузится из API (newsCategoriesService).
// Мокаем модуль, чтобы тест был оффлайн и предсказуем.
const mockGetCategories: ReturnType<
  typeof vi.fn<(...args: unknown[]) => Promise<HvacNewsCategoryItem[]>>
> = vi.fn();
vi.mock('../../services/newsCategoriesService', () => ({
  default: {
    getNewsCategories: () => mockGetCategories(),
  },
}));

// Radix Select использует pointer-events capturing + ResizeObserver;
// подставляем минимальные моки.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  mockGetCategories.mockReset();
  // По умолчанию возвращаем 8 legacy-категорий (имитируем NewsCategory из БД).
  mockGetCategories.mockResolvedValue([
    { slug: 'business', name: 'Деловые', order: 1, is_active: true },
    { slug: 'industry', name: 'Индустрия', order: 2, is_active: true },
    { slug: 'market', name: 'Рынок', order: 3, is_active: true },
    { slug: 'regulation', name: 'Регулирование', order: 4, is_active: true },
    { slug: 'review', name: 'Обзор', order: 5, is_active: true },
    { slug: 'guide', name: 'Гайд', order: 6, is_active: true },
    { slug: 'brands', name: 'Бренды', order: 7, is_active: true },
    { slug: 'other', name: 'Прочее', order: 8, is_active: true },
  ]);
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    NoopResizeObserver as unknown as typeof ResizeObserver;
  // Radix проверяет matchMedia/hasPointerCapture
  if (typeof window !== 'undefined') {
    window.matchMedia =
      window.matchMedia ||
      (vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia);
    // jsdom не имеет этих методов — Radix Select крашится без них
    Element.prototype.hasPointerCapture ||= () => false;
    Element.prototype.scrollIntoView ||= () => {};
  }
});

function renderFields(
  overrides: Partial<React.ComponentProps<typeof EditorialMetaFields>> = {},
) {
  const onCategoryChange = vi.fn();
  const onLedeChange = vi.fn();
  const utils = render(
    <EditorialMetaFields
      category={('other' as HvacNewsCategory)}
      onCategoryChange={onCategoryChange}
      lede=""
      onLedeChange={onLedeChange}
      readingTimeMinutes={null}
      {...overrides}
    />,
  );
  return { ...utils, onCategoryChange, onLedeChange };
}

describe('EditorialMetaFields', () => {
  it('рендерит trigger с выбранной категорией (динамический список из API)', async () => {
    renderFields({ category: 'business' });
    // После загрузки из API в триггере должно быть имя выбранной категории.
    await waitFor(() => {
      expect(screen.getByText('Деловые')).toBeInTheDocument();
    });
    expect(mockGetCategories).toHaveBeenCalled();
  });

  it('grace fallback: при пустом ответе API в Select остаётся "Прочее"', async () => {
    mockGetCategories.mockResolvedValueOnce([]);
    renderFields({ category: 'other' });
    await waitFor(() => {
      expect(mockGetCategories).toHaveBeenCalled();
    });
    // Триггер показывает "Прочее" (single fallback SelectItem).
    expect(screen.getByText('Прочее')).toBeInTheDocument();
  });

  it('lede textarea: ввод вызывает onLedeChange', () => {
    const { onLedeChange } = renderFields();
    const textarea = screen.getByLabelText('Лид (подзаголовок)') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Новый подзаголовок' } });
    expect(onLedeChange).toHaveBeenCalledWith('Новый подзаголовок');
  });

  it('lede длина отображается как counter (N/300)', () => {
    renderFields({ lede: 'abcde' });
    expect(screen.getByText(`5/${LEDE_SOFT_MAX}`)).toBeInTheDocument();
  });

  it('lede длина > 300 подсвечивается предупреждением', () => {
    renderFields({ lede: 'x'.repeat(LEDE_SOFT_MAX + 1) });
    expect(
      screen.getByText(/Рекомендуется держать лид до 300 символов/),
    ).toBeInTheDocument();
  });

  it('reading_time readonly: показывает "~N мин чтения" если число пришло', () => {
    renderFields({ readingTimeMinutes: 7 });
    expect(screen.getByTestId('news-reading-time').textContent).toContain('~7 мин');
  });

  it('reading_time: показывает fallback при null', () => {
    renderFields({ readingTimeMinutes: null });
    expect(screen.getByTestId('news-reading-time').textContent).toMatch(
      /вычислено автоматически/,
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HvacNews } from '@/lib/api/types/hvac';
import NewsFeedList from './NewsFeedList';

const searchParamsState: { value: string } = { value: '' };

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}));

beforeEach(() => {
  searchParamsState.value = '';
});

afterEach(() => {
  searchParamsState.value = '';
});

const mkItem = (id: number, partial: Partial<HvacNews> = {}): HvacNews => ({
  id,
  title: `Новость №${id}`,
  body: `<p>Тело новости ${id}, текст лида для проверки.</p>`,
  pub_date: '2026-04-21T10:00:00Z',
  category: 'industry',
  category_display: 'Индустрия',
  ...partial,
});

const items = [mkItem(1), mkItem(2), mkItem(3)];

describe('NewsFeedList — view modes', () => {
  it('default (нет ?view): рендерит grid с тремя колонками', () => {
    const { container } = render(
      <NewsFeedList items={items} hasMore={false} totalCount={items.length} />,
    );
    const grid = container.querySelector('[data-view="grid"]');
    expect(grid).toBeInTheDocument();
    expect(container.querySelector('[data-view="list"]')).toBeNull();
    expect(grid).toHaveStyle({ display: 'grid' });
  });

  it('?view=list: рендерит row-структуру (image и body — соседи в flex-row)', () => {
    searchParamsState.value = 'view=list';
    const { container } = render(
      <NewsFeedList items={items} hasMore={false} totalCount={items.length} />,
    );
    const list = container.querySelector('[data-view="list"]');
    expect(list).toBeInTheDocument();
    expect(container.querySelector('[data-view="grid"]')).toBeNull();
    expect(list).toHaveStyle({ display: 'flex', flexDirection: 'column' });

    const rows = container.querySelectorAll('.rt-feed-row');
    expect(rows.length).toBe(items.length);
    const firstRow = rows[0] as HTMLElement;
    expect(firstRow).toHaveStyle({ display: 'flex', flexDirection: 'row' });

    const img = firstRow.querySelector('.rt-feed-row-img');
    const body = firstRow.querySelector('.rt-feed-row-body');
    expect(img).toBeInTheDocument();
    expect(body).toBeInTheDocument();
    expect(img?.parentElement).toBe(body?.parentElement);
  });

  it('?view=grid (явно): рендерит grid', () => {
    searchParamsState.value = 'view=grid';
    const { container } = render(
      <NewsFeedList items={items} hasMore={false} totalCount={items.length} />,
    );
    expect(container.querySelector('[data-view="grid"]')).toBeInTheDocument();
    expect(container.querySelector('[data-view="list"]')).toBeNull();
  });

  it('?view=list: показывает лид (3 строки) и заголовок каждой новости', () => {
    searchParamsState.value = 'view=list';
    render(<NewsFeedList items={items} hasMore={false} totalCount={items.length} />);
    expect(screen.getByText('Новость №1')).toBeInTheDocument();
    expect(screen.getByText('Новость №2')).toBeInTheDocument();
    expect(screen.getByText(/Тело новости 1/)).toBeInTheDocument();
  });

  it('фильтрация по category работает в обоих видах', () => {
    searchParamsState.value = 'view=list&category=business';
    const mixed = [mkItem(1, { category: 'business' }), mkItem(2, { category: 'industry' })];
    const { container } = render(
      <NewsFeedList items={mixed} hasMore={false} totalCount={mixed.length} />,
    );
    const rows = container.querySelectorAll('.rt-feed-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Новость №1');
  });

  it('skipFirst применяется в list-виде так же как в grid', () => {
    searchParamsState.value = 'view=list';
    const { container } = render(
      <NewsFeedList items={items} hasMore={false} totalCount={items.length} skipFirst={1} />,
    );
    const rows = container.querySelectorAll('.rt-feed-row');
    expect(rows.length).toBe(items.length - 1);
    expect(rows[0].textContent).toContain('Новость №2');
  });

  it('пустой visible после фильтрации: показывает empty-state в обоих видах', () => {
    searchParamsState.value = 'view=list&category=brands';
    render(<NewsFeedList items={items} hasMore={false} totalCount={items.length} />);
    expect(screen.getByText(/нет публикаций/i)).toBeInTheDocument();
  });
});

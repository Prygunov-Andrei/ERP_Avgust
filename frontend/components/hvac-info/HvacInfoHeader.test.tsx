import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HvacInfoHeader from './HvacInfoHeader';

const pathnameMock = vi.fn<() => string>(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

describe('HvacInfoHeader active-state', () => {
  it('корневая /: «Новости» active, «Рейтинг» неактивна', () => {
    pathnameMock.mockReturnValue('/');
    render(<HvacInfoHeader />);
    const news = screen.getByRole('link', { hidden: true, name: 'Новости' });
    expect(news).toHaveAttribute('aria-current', 'page');
    const rating = screen.getByRole('link', { hidden: true, name: 'Рейтинг' });
    expect(rating).not.toHaveAttribute('aria-current', 'page');
  });

  it('/news/123: «Новости» active', () => {
    pathnameMock.mockReturnValue('/news/123');
    render(<HvacInfoHeader />);
    expect(screen.getByRole('link', { hidden: true, name: 'Новости' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('/ratings/abc: «Рейтинг» active', () => {
    pathnameMock.mockReturnValue('/ratings/abc');
    render(<HvacInfoHeader />);
    expect(screen.getByRole('link', { hidden: true, name: 'Рейтинг' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { hidden: true, name: 'Новости' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('/smeta/*: «ISmeta» active', () => {
    pathnameMock.mockReturnValue('/smeta/est-7');
    render(<HvacInfoHeader />);
    expect(screen.getByRole('link', { hidden: true, name: 'ISmeta' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('muted-пункты не являются ссылками и не получают aria-current', () => {
    pathnameMock.mockReturnValue('/');
    render(<HvacInfoHeader />);
    expect(screen.queryByRole('link', { hidden: true, name: 'Мешок Монтажников' })).toBeNull();
  });
});

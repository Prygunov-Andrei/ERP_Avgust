import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ACPresetsPage from './ACPresetsPage';
import type { ACPreset } from '../services/acRatingTypes';

const mockGetPresets = vi.fn();
const mockDeletePreset = vi.fn();

vi.mock('../services/acRatingService', () => ({
  default: {
    getPresets: (...args: unknown[]) => mockGetPresets(...args),
    deletePreset: (...args: unknown[]) => mockDeletePreset(...args),
  },
}));

vi.mock('../hooks/useHvacAuth', () => ({
  useHvacAuth: () => ({ user: { is_staff: true } }),
}));

const mockNavigate = vi.fn();
vi.mock('@/hooks/erp-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/hvac-rating/presets' }),
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const SAMPLE: ACPreset[] = [
  {
    id: 1,
    slug: 'home-priority',
    label: 'Для дома',
    order: 1,
    is_active: true,
    description: '',
    is_all_selected: false,
    criteria_ids: [10, 11, 12],
    criteria_count: 3,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-22T00:00:00Z',
  },
  {
    id: 2,
    slug: 'all',
    label: 'Профессиональный',
    order: 99,
    is_active: true,
    description: '',
    is_all_selected: true,
    criteria_ids: [],
    criteria_count: -1,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-22T00:00:00Z',
  },
];

beforeEach(() => {
  mockGetPresets.mockReset();
  mockDeletePreset.mockReset();
  mockNavigate.mockReset();
  mockGetPresets.mockResolvedValue({
    items: SAMPLE,
    next: null,
    count: SAMPLE.length,
  });

  (
    globalThis as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;
  if (typeof window !== 'undefined') {
    window.matchMedia =
      window.matchMedia ||
      (vi.fn().mockImplementation((q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia);
    Element.prototype.hasPointerCapture ||= () => false;
    Element.prototype.scrollIntoView ||= () => {};
  }
});

describe('ACPresetsPage', () => {
  it('рендерит список пресетов', async () => {
    render(<ACPresetsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('ac-preset-row-1')).toBeInTheDocument();
    });
    expect(screen.getByText('Для дома')).toBeInTheDocument();
    expect(screen.getByText('home-priority')).toBeInTheDocument();
    expect(screen.getByText('Профессиональный')).toBeInTheDocument();
  });

  it('criteria_count=-1 рендерится как «ВСЕ»', async () => {
    render(<ACPresetsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('ac-preset-row-2')).toBeInTheDocument()
    );
    // В таблице (Badge) и в колонке counts
    expect(screen.getAllByText('ВСЕ').length).toBeGreaterThan(0);
  });

  it('delete вызывает API с нужным id', async () => {
    mockDeletePreset.mockResolvedValue(undefined);
    render(<ACPresetsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('ac-preset-row-1')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('ac-preset-delete-1'));
    fireEvent.click(screen.getByText('Удалить', { selector: 'button' }));

    await waitFor(() => {
      expect(mockDeletePreset).toHaveBeenCalledWith(1);
    });
  });

  it('фильтр is_all_selected → шлёт is_all_selected=true', async () => {
    render(<ACPresetsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('ac-preset-row-1')).toBeInTheDocument()
    );

    mockGetPresets.mockClear();
    fireEvent.click(screen.getByTestId('ac-presets-all-selected'));

    await waitFor(() => {
      expect(mockGetPresets).toHaveBeenCalled();
      const lastCall = mockGetPresets.mock.calls.at(-1);
      expect(lastCall?.[0]).toMatchObject({ is_all_selected: 'true' });
    });
  });
});

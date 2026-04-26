import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ACPresetEditor from './ACPresetEditor';
import type {
  ACCriterionListItem,
  ACPreset,
} from '../services/acRatingTypes';

const mockGetPreset = vi.fn();
const mockGetCriteria = vi.fn();
const mockCreatePreset = vi.fn();
const mockUpdatePreset = vi.fn();

vi.mock('../services/acRatingService', () => ({
  default: {
    getPreset: (...args: unknown[]) => mockGetPreset(...args),
    getCriteria: (...args: unknown[]) => mockGetCriteria(...args),
    createPreset: (...args: unknown[]) => mockCreatePreset(...args),
    updatePreset: (...args: unknown[]) => mockUpdatePreset(...args),
    deletePreset: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
vi.mock('@/hooks/erp-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
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

const CRITERIA: ACCriterionListItem[] = [
  {
    id: 10,
    code: 'noise_min',
    name_ru: 'Шум (мин)',
    photo_url: '',
    unit: 'дБ',
    value_type: 'numeric',
    group: 'acoustics',
    is_active: true,
    is_key_measurement: true,
    methodologies_count: 1,
  },
  {
    id: 11,
    code: 'cooling_capacity',
    name_ru: 'Холодопроизводительность',
    photo_url: '',
    unit: 'кВт',
    value_type: 'numeric',
    group: 'climate',
    is_active: true,
    is_key_measurement: true,
    methodologies_count: 1,
  },
];

const SAMPLE: ACPreset = {
  id: 5,
  slug: 'home-priority',
  label: 'Для дома',
  order: 1,
  is_active: true,
  description: 'Описание',
  is_all_selected: false,
  criteria_ids: [10],
  criteria_count: 1,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-22T00:00:00Z',
};

beforeEach(() => {
  mockGetPreset.mockReset();
  mockGetCriteria.mockReset();
  mockCreatePreset.mockReset();
  mockUpdatePreset.mockReset();
  mockNavigate.mockReset();
  mockUseParams.mockReset();

  mockGetCriteria.mockResolvedValue({
    items: CRITERIA,
    next: null,
    count: CRITERIA.length,
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

describe('ACPresetEditor — create', () => {
  it('валидация — без label не шлёт createPreset', async () => {
    mockUseParams.mockReturnValue({});
    render(<ACPresetEditor mode="create" />);
    await waitFor(() => {
      expect(screen.getByText(/Новый пресет/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('ac-preset-slug'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByTestId('ac-preset-save'));

    await waitFor(() => {
      expect(mockCreatePreset).not.toHaveBeenCalled();
    });
  });

  it('создаёт пресет с criteria_ids в payload', async () => {
    mockUseParams.mockReturnValue({});
    mockCreatePreset.mockResolvedValue({ ...SAMPLE, id: 99 });

    render(<ACPresetEditor mode="create" />);
    await waitFor(() => screen.getByTestId('ac-preset-criterion-10'));

    fireEvent.change(screen.getByTestId('ac-preset-label'), {
      target: { value: 'Для дома' },
    });
    fireEvent.change(screen.getByTestId('ac-preset-slug'), {
      target: { value: 'home' },
    });

    // отметить критерий 10 (Шум)
    fireEvent.click(
      screen.getByTestId('ac-preset-criterion-10').querySelector('button')!
    );

    fireEvent.click(screen.getByTestId('ac-preset-save'));

    await waitFor(() => {
      expect(mockCreatePreset).toHaveBeenCalledTimes(1);
    });
    const payload = mockCreatePreset.mock.calls[0][0];
    expect(payload.label).toBe('Для дома');
    expect(payload.slug).toBe('home');
    expect(payload.is_all_selected).toBe(false);
    expect(payload.criteria_ids).toEqual([10]);
    expect(mockNavigate).toHaveBeenCalledWith('/hvac-rating/presets/edit/99');
  });

  it('is_all_selected=true → criteria_ids очищается в payload', async () => {
    mockUseParams.mockReturnValue({});
    mockCreatePreset.mockResolvedValue({ ...SAMPLE, id: 100 });

    render(<ACPresetEditor mode="create" />);
    await waitFor(() => screen.getByTestId('ac-preset-criterion-10'));

    fireEvent.change(screen.getByTestId('ac-preset-label'), {
      target: { value: 'Все' },
    });
    fireEvent.change(screen.getByTestId('ac-preset-slug'), {
      target: { value: 'all' },
    });
    // отметим один критерий, потом включим is_all_selected
    fireEvent.click(
      screen.getByTestId('ac-preset-criterion-10').querySelector('button')!
    );
    fireEvent.click(screen.getByTestId('ac-preset-all-selected'));

    fireEvent.click(screen.getByTestId('ac-preset-save'));

    await waitFor(() => {
      expect(mockCreatePreset).toHaveBeenCalledTimes(1);
    });
    const payload = mockCreatePreset.mock.calls[0][0];
    expect(payload.is_all_selected).toBe(true);
    expect(payload.criteria_ids).toEqual([]);
  });
});

describe('ACPresetEditor — edit', () => {
  it('подгружает пресет и сохраняет PATCH-вызов', async () => {
    mockUseParams.mockReturnValue({ id: '5' });
    mockGetPreset.mockResolvedValue(SAMPLE);
    mockUpdatePreset.mockResolvedValue({ ...SAMPLE, label: 'Обновлено' });

    render(<ACPresetEditor mode="edit" />);

    await waitFor(() => {
      const label = screen.getByTestId('ac-preset-label') as HTMLInputElement;
      expect(label.value).toBe('Для дома');
    });
    const slug = screen.getByTestId('ac-preset-slug') as HTMLInputElement;
    expect(slug.value).toBe('home-priority');

    fireEvent.change(screen.getByTestId('ac-preset-label'), {
      target: { value: 'Обновлено' },
    });
    fireEvent.click(screen.getByTestId('ac-preset-save'));

    await waitFor(() => {
      expect(mockUpdatePreset).toHaveBeenCalledTimes(1);
    });
    const [id, payload] = mockUpdatePreset.mock.calls[0];
    expect(id).toBe(5);
    expect(payload.label).toBe('Обновлено');
    expect(payload.criteria_ids).toEqual([10]);
  });
});

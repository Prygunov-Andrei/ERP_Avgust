import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/api/services/hvac-ismeta-public', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/api/services/hvac-ismeta-public')
  >('@/lib/api/services/hvac-ismeta-public');
  return {
    ...actual,
    hvacIsmetaPublicService: {
      getOptions: vi.fn(),
      parsePdf: vi.fn(),
      getProgress: vi.fn(),
      getResult: vi.fn(),
      excelDownloadUrl: (id: string) => `/api/hvac/ismeta/jobs/${id}/excel`,
      sendFeedback: vi.fn(),
    },
  };
});

import {
  IsmetaApiError,
  hvacIsmetaPublicService,
} from '@/lib/api/services/hvac-ismeta-public';
import { useIsmetaJob } from './useIsmetaJob';

const mocked = hvacIsmetaPublicService as unknown as {
  parsePdf: ReturnType<typeof vi.fn>;
  getProgress: ReturnType<typeof vi.fn>;
  getResult: ReturnType<typeof vi.fn>;
};

function fakeFile(): File {
  return new File([new Uint8Array(0)], 'a.pdf', { type: 'application/pdf' });
}

beforeEach(() => {
  mocked.parsePdf.mockReset();
  mocked.getProgress.mockReset();
  mocked.getResult.mockReset();
});

afterEach(() => {
  vi.clearAllTimers();
});

describe('useIsmetaJob — state transitions', () => {
  it('initial state = idle', () => {
    const { result } = renderHook(() => useIsmetaJob());
    expect(result.current.state.status).toBe('idle');
  });

  it('happy path: status=done на первом polling tick → state=done', async () => {
    mocked.parsePdf.mockResolvedValue({ job_id: 'job-1' });
    // Сразу done — pollProgress не уйдёт во второй tick.
    mocked.getProgress.mockResolvedValueOnce({
      status: 'done',
      pages_total: 4,
      pages_processed: 4,
      items_count: 28,
      error_message: '',
    });
    mocked.getResult.mockResolvedValue({
      items: [{ position: 1, name: 'A', model: 'X', qty: 1, unit: 'шт' }],
      pages_stats: { total: 4, processed: 4, skipped: 0 },
      cost_usd: 0.36,
    });

    const { result } = renderHook(() => useIsmetaJob());

    await act(async () => {
      await result.current.start(fakeFile(), { pipeline: 'td17g' });
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe('done');
    });
    if (result.current.state.status === 'done') {
      expect(result.current.state.itemsCount).toBe(1);
      expect(result.current.state.costUsd).toBe(0.36);
      expect(result.current.state.pagesStats.processed).toBe(4);
    }
    expect(mocked.parsePdf).toHaveBeenCalledTimes(1);
    expect(mocked.getResult).toHaveBeenCalledWith('job-1');
  });

  it('429 на parsePdf → error.concurrency=true', async () => {
    mocked.parsePdf.mockRejectedValue(new IsmetaApiError(429, 'rate limited'));
    const { result } = renderHook(() => useIsmetaJob());
    await act(async () => {
      await result.current.start(fakeFile(), {});
    });
    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.concurrency).toBe(true);
      expect(result.current.state.message).toMatch(/обработка/i);
    }
  });

  it('503 на parsePdf → error.serviceDown=true', async () => {
    mocked.parsePdf.mockRejectedValue(new IsmetaApiError(503, 'maintenance'));
    const { result } = renderHook(() => useIsmetaJob());
    await act(async () => {
      await result.current.start(fakeFile(), {});
    });
    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.serviceDown).toBe(true);
      expect(result.current.state.concurrency).toBeFalsy();
    }
  });

  it('backend status=error на progress → state=error с error_message', async () => {
    mocked.parsePdf.mockResolvedValue({ job_id: 'job-2' });
    mocked.getProgress.mockResolvedValueOnce({
      status: 'error',
      pages_total: 0,
      pages_processed: 0,
      items_count: 0,
      error_message: 'PDF повреждён',
    });
    const { result } = renderHook(() => useIsmetaJob());
    await act(async () => {
      await result.current.start(fakeFile(), {});
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toBe('PDF повреждён');
    }
    // getResult НЕ вызывается на error.
    expect(mocked.getResult).not.toHaveBeenCalled();
  });

  it('reset из error → idle', async () => {
    mocked.parsePdf.mockRejectedValue(new IsmetaApiError(429, 'busy'));
    const { result } = renderHook(() => useIsmetaJob());
    await act(async () => {
      await result.current.start(fakeFile(), {});
    });
    expect(result.current.state.status).toBe('error');
    act(() => {
      result.current.reset();
    });
    expect(result.current.state.status).toBe('idle');
  });

  it('cancelled на progress → state=error с осмысленным сообщением', async () => {
    mocked.parsePdf.mockResolvedValue({ job_id: 'job-3' });
    mocked.getProgress.mockResolvedValueOnce({
      status: 'cancelled',
      pages_total: 0,
      pages_processed: 0,
      items_count: 0,
      error_message: '',
    });
    const { result } = renderHook(() => useIsmetaJob());
    await act(async () => {
      await result.current.start(fakeFile(), {});
    });
    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    if (result.current.state.status === 'error') {
      expect(result.current.state.message).toMatch(/отмен/i);
    }
  });
});

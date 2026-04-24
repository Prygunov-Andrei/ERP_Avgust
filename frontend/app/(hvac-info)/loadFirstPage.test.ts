import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { loadFirstPage } from './loadFirstPage';
import type { HvacNews } from '@/lib/api/types/hvac';

const mkNews = (id: number): HvacNews => ({
  id,
  title: `news-${id}`,
  body: '',
  pub_date: '2026-04-21T10:00:00Z',
});

const noSleep = () => Promise.resolve();

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadFirstPage', () => {
  it('возвращает данные с первой успешной попытки', async () => {
    const fetcher = vi.fn(async () => ({
      results: [mkNews(1), mkNews(2)],
      count: 2,
      next: null,
      previous: null,
    }));

    const res = await loadFirstPage(fetcher, { sleep: noSleep });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(res.empty).toBe(false);
    expect(res.page.results).toHaveLength(2);
    expect(res.lastError).toBeNull();
  });

  it('ретраит при брошенной ошибке и возвращает данные с третьей попытки', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('ENOTFOUND'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({
        results: [mkNews(7)],
        count: 1,
        next: null,
        previous: null,
      });

    const res = await loadFirstPage(fetcher, { sleep: noSleep });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(res.empty).toBe(false);
    expect(res.page.results).toHaveLength(1);
  });

  it('при пустом первом ответе ретраит и берёт данные второй попытки', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ results: [], count: 0, next: null, previous: null })
      .mockResolvedValueOnce({
        results: [mkNews(1)],
        count: 1,
        next: null,
        previous: null,
      });

    const res = await loadFirstPage(fetcher, { sleep: noSleep });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(res.empty).toBe(false);
    expect(res.page.results).toHaveLength(1);
  });

  it('после всех пустых попыток возвращает empty=true', async () => {
    const fetcher = vi.fn(async () => ({
      results: [],
      count: 0,
      next: null,
      previous: null,
    }));

    const res = await loadFirstPage(fetcher, { sleep: noSleep, maxAttempts: 3 });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(res.empty).toBe(true);
    expect(res.page.results).toEqual([]);
    expect(res.lastError).toBeNull();
  });

  it('если все попытки бросают — empty=true и lastError заполнен', async () => {
    const err = new Error('boom');
    const fetcher = vi.fn().mockRejectedValue(err);

    const res = await loadFirstPage(fetcher, { sleep: noSleep, maxAttempts: 3 });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(res.empty).toBe(true);
    expect(res.lastError).toBe(err);
    expect(res.page.results).toEqual([]);
  });

  it('делает паузу между попытками через переданный sleep', async () => {
    const sleep = vi.fn(async () => {});
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce({
        results: [mkNews(1)],
        count: 1,
        next: null,
        previous: null,
      });

    await loadFirstPage(fetcher, { sleep, retryDelayMs: 500, maxAttempts: 3 });

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('не делает паузу после последней попытки', async () => {
    const sleep = vi.fn(async () => {});
    const fetcher = vi.fn().mockRejectedValue(new Error('x'));

    await loadFirstPage(fetcher, { sleep, maxAttempts: 2 });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

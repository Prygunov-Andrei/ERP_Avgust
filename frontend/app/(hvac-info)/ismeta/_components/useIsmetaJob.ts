'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  IsmetaApiError,
  hvacIsmetaPublicService,
} from '@/lib/api/services/hvac-ismeta-public';
import type {
  IsmetaParseRequest,
  IsmetaProgressPhase,
} from '@/lib/api/types/hvac-ismeta-public';
import type { JobState } from './types';

// F8-Sprint4: localStorage ключ для resume на refresh страницы.
const ACTIVE_JOB_STORAGE_KEY = 'ismeta_active_job';

function readActiveJobId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

function writeActiveJobId(jobId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (jobId) {
      window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
    } else {
      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    }
  } catch {
    // private mode / quota — игнорируем, не блокируем основной flow.
  }
}

type Action =
  | { type: 'reset' }
  | { type: 'upload-start' }
  | { type: 'upload-failed'; message: string; status?: number; code?: string }
  | { type: 'processing-start'; jobId: string }
  | {
      type: 'progress-tick';
      payload: {
        pagesProcessed: number;
        pagesTotal: number;
        itemsCount: number;
        backendStatus:
          | 'queued'
          | 'processing'
          | 'done'
          | 'error'
          | 'cancelled';
        phase?: IsmetaProgressPhase | '';
        currentPageLabel?: string;
        elapsedSeconds?: number | null;
        etaSeconds?: number | null;
      };
    }
  | {
      type: 'finish';
      payload: {
        jobId: string;
        items: import('@/lib/api/types/hvac-ismeta-public').IsmetaItem[];
        itemsCount: number;
        pagesStats: import('@/lib/api/types/hvac-ismeta-public').IsmetaPagesStats;
        costUsd: number;
      };
    }
  | { type: 'fail'; message: string };

function reducer(state: JobState, action: Action): JobState {
  switch (action.type) {
    case 'reset':
      return { status: 'idle' };
    case 'upload-start':
      return { status: 'uploading' };
    case 'upload-failed': {
      // Если backend не прислал code (legacy F8-03 / network error), но статус 429 —
      // считаем concurrency (старый default из F8-03).
      const isRate429 =
        action.status === 429 &&
        (action.code === 'rate_session' ||
          action.code === 'rate_ip_hourly' ||
          action.code === 'rate_ip_daily');
      return {
        status: 'error',
        message: action.message,
        concurrency: action.status === 429 && !isRate429,
        rateLimited: isRate429,
        rateLimitCode: action.code,
        serviceDown: action.status === 503,
      };
    }
    case 'processing-start':
      return {
        status: 'processing',
        jobId: action.jobId,
        pagesProcessed: 0,
        pagesTotal: 0,
        itemsCount: 0,
        backendStatus: 'queued',
        phase: '',
        currentPageLabel: '',
        elapsedSeconds: null,
        etaSeconds: null,
      };
    case 'progress-tick':
      if (state.status !== 'processing') return state;
      return {
        ...state,
        pagesProcessed: action.payload.pagesProcessed,
        pagesTotal: action.payload.pagesTotal,
        itemsCount: action.payload.itemsCount,
        backendStatus: action.payload.backendStatus,
        phase: action.payload.phase ?? state.phase ?? '',
        currentPageLabel:
          action.payload.currentPageLabel ?? state.currentPageLabel ?? '',
        elapsedSeconds:
          action.payload.elapsedSeconds ?? state.elapsedSeconds ?? null,
        etaSeconds: action.payload.etaSeconds ?? state.etaSeconds ?? null,
      };
    case 'finish':
      return {
        status: 'done',
        jobId: action.payload.jobId,
        items: action.payload.items,
        itemsCount: action.payload.itemsCount,
        pagesStats: action.payload.pagesStats,
        costUsd: action.payload.costUsd,
      };
    case 'fail':
      return { status: 'error', message: action.message };
    default:
      return state;
  }
}

export const POLL_INTERVAL_MS = 2500;

export interface UseIsmetaJob {
  state: JobState;
  start: (file: File, options: IsmetaParseRequest) => Promise<void>;
  reset: () => void;
}

export function useIsmetaJob(): UseIsmetaJob {
  const [state, dispatch] = useReducer(reducer, {
    status: 'idle',
  } as JobState);

  // Используем ref для polling timer'а — чтобы не зависеть от state в effect-е.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup на unmount.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopPolling();
    };
  }, [stopPolling]);

  const pollProgress = useCallback(
    async (jobId: string) => {
      if (cancelledRef.current) return;
      try {
        const progress = await hvacIsmetaPublicService.getProgress(jobId);
        if (cancelledRef.current) return;
        dispatch({
          type: 'progress-tick',
          payload: {
            pagesProcessed: progress.pages_processed,
            pagesTotal: progress.pages_total,
            itemsCount: progress.items_count,
            backendStatus: progress.status,
            phase: progress.phase,
            currentPageLabel: progress.current_page_label,
            elapsedSeconds: progress.elapsed_seconds,
            etaSeconds: progress.eta_seconds,
          },
        });
        if (progress.status === 'done') {
          const result = await hvacIsmetaPublicService.getResult(jobId);
          if (cancelledRef.current) return;
          writeActiveJobId(null);
          dispatch({
            type: 'finish',
            payload: {
              jobId,
              items: result.items,
              itemsCount: result.items.length,
              pagesStats: result.pages_stats,
              costUsd: result.cost_usd,
            },
          });
          return;
        }
        if (progress.status === 'error' || progress.status === 'cancelled') {
          writeActiveJobId(null);
          dispatch({
            type: 'fail',
            message:
              progress.error_message ||
              (progress.status === 'cancelled'
                ? 'Обработка отменена'
                : 'Ошибка распознавания'),
          });
          return;
        }
        // queued / processing — продолжаем poll.
        timerRef.current = setTimeout(
          () => pollProgress(jobId),
          POLL_INTERVAL_MS,
        );
      } catch (err) {
        if (cancelledRef.current) return;
        const message =
          err instanceof Error ? err.message : 'Ошибка соединения';
        // 404 означает что job стерт (TTL базы или дев-перезапуск); не оставляем
        // зомби в localStorage, иначе резюмим в бесконечный цикл fail на refresh.
        if (err instanceof IsmetaApiError && err.status === 404) {
          writeActiveJobId(null);
        }
        dispatch({ type: 'fail', message });
      }
    },
    [],
  );

  const start = useCallback(
    async (file: File, options: IsmetaParseRequest) => {
      stopPolling();
      cancelledRef.current = false;
      dispatch({ type: 'upload-start' });
      try {
        const { job_id } = await hvacIsmetaPublicService.parsePdf(
          file,
          options,
        );
        // F8-Sprint4: persist для resume на refresh.
        writeActiveJobId(job_id);
        dispatch({ type: 'processing-start', jobId: job_id });
        await pollProgress(job_id);
      } catch (err) {
        const status = err instanceof IsmetaApiError ? err.status : undefined;
        const code = err instanceof IsmetaApiError ? err.code : undefined;
        let message = err instanceof Error ? err.message : 'Не удалось загрузить файл';
        if (status === 429) {
          if (code === 'concurrency') {
            message =
              'У вас уже идёт обработка PDF. Дождитесь её завершения и попробуйте снова.';
          } else if (code === 'rate_session') {
            message =
              'Превышен лимит загрузок с вашей сессии за час. Попробуйте через час.';
          } else if (code === 'rate_ip_hourly') {
            message =
              'Превышен часовой лимит загрузок с вашего IP. Попробуйте через час.';
          } else if (code === 'rate_ip_daily') {
            message =
              'Превышен суточный лимит загрузок с вашего IP. Попробуйте завтра.';
          } else {
            message =
              'У вас уже идёт обработка PDF. Дождитесь её завершения и попробуйте снова.';
          }
        } else if (status === 503) {
          message = 'Сервис временно на обслуживании. Попробуйте позже.';
        } else if (status === 400) {
          message = message || 'Файл некорректен или слишком большой.';
        }
        dispatch({ type: 'upload-failed', message, status, code });
      }
    },
    [pollProgress, stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    cancelledRef.current = false;
    writeActiveJobId(null);
    dispatch({ type: 'reset' });
  }, [stopPolling]);

  // F8-Sprint4: resume на mount если в localStorage есть active job.
  // Поведение: первый /progress определяет, жив ли job:
  //   - status=processing/queued → переходим в state=processing и poll'им
  //   - status=done → вытаскиваем result, переходим в state=done
  //   - status=error/cancelled или 404 → чистим storage, остаёмся в idle
  // Не выставляем зависимости — effect должен сработать ровно один раз
  // при монтировании. Cleanup-ref внутри pollProgress остановит цикл если
  // user уйдёт с страницы.
  useEffect(() => {
    const stored = readActiveJobId();
    if (!stored) return;
    let aborted = false;
    void (async () => {
      try {
        const progress = await hvacIsmetaPublicService.getProgress(stored);
        if (aborted || cancelledRef.current) return;
        if (progress.status === 'done') {
          const result = await hvacIsmetaPublicService.getResult(stored);
          if (aborted || cancelledRef.current) return;
          writeActiveJobId(null);
          dispatch({
            type: 'finish',
            payload: {
              jobId: stored,
              items: result.items,
              itemsCount: result.items.length,
              pagesStats: result.pages_stats,
              costUsd: result.cost_usd,
            },
          });
          return;
        }
        if (
          progress.status === 'error' ||
          progress.status === 'cancelled'
        ) {
          writeActiveJobId(null);
          return;
        }
        // active → resume polling.
        dispatch({ type: 'processing-start', jobId: stored });
        dispatch({
          type: 'progress-tick',
          payload: {
            pagesProcessed: progress.pages_processed,
            pagesTotal: progress.pages_total,
            itemsCount: progress.items_count,
            backendStatus: progress.status,
            phase: progress.phase,
            currentPageLabel: progress.current_page_label,
            elapsedSeconds: progress.elapsed_seconds,
            etaSeconds: progress.eta_seconds,
          },
        });
        await pollProgress(stored);
      } catch (err) {
        // Job не найден / Redis нет — снимаем флаг, не показываем error.
        if (err instanceof IsmetaApiError && err.status === 404) {
          writeActiveJobId(null);
        }
      }
    })();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, start, reset };
}

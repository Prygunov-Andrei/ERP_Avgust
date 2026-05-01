'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  IsmetaApiError,
  hvacIsmetaPublicService,
} from '@/lib/api/services/hvac-ismeta-public';
import type { IsmetaParseRequest } from '@/lib/api/types/hvac-ismeta-public';
import type { JobState } from './types';

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
      };
    case 'progress-tick':
      if (state.status !== 'processing') return state;
      return {
        ...state,
        pagesProcessed: action.payload.pagesProcessed,
        pagesTotal: action.payload.pagesTotal,
        itemsCount: action.payload.itemsCount,
        backendStatus: action.payload.backendStatus,
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
          },
        });
        if (progress.status === 'done') {
          const result = await hvacIsmetaPublicService.getResult(jobId);
          if (cancelledRef.current) return;
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
    dispatch({ type: 'reset' });
  }, [stopPolling]);

  return { state, start, reset };
}

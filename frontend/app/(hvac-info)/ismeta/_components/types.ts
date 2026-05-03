import type {
  IsmetaItem,
  IsmetaJobStatus,
  IsmetaPagesStats,
  IsmetaProgressPhase,
} from '@/lib/api/types/hvac-ismeta-public';

export type JobState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | {
      status: 'processing';
      jobId: string;
      pagesProcessed: number;
      pagesTotal: number;
      itemsCount: number;
      backendStatus: IsmetaJobStatus;
      // F8-Sprint4 — live-state из Redis (опц.).
      phase?: IsmetaProgressPhase | '';
      currentPageLabel?: string;
      elapsedSeconds?: number | null;
      etaSeconds?: number | null;
    }
  | {
      status: 'done';
      jobId: string;
      items: IsmetaItem[];
      itemsCount: number;
      pagesStats: IsmetaPagesStats;
      costUsd: number;
    }
  | {
      status: 'error';
      message: string;
      concurrency?: boolean;
      rateLimited?: boolean;
      rateLimitCode?: string;
      serviceDown?: boolean;
    };

// F8-Sprint4: константы переехали в общий ProgressView (frontend/components/ismeta).
// Re-export сохраняем для обратной совместимости с тестами/виджетами.
export {
  PIPELINE_AVG_SEC_PER_PAGE,
  DEFAULT_AVG_SEC_PER_PAGE,
} from '@/components/ismeta/ProgressView';

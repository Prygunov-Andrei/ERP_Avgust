import type {
  IsmetaItem,
  IsmetaJobStatus,
  IsmetaPagesStats,
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

export const PIPELINE_AVG_SEC_PER_PAGE: Record<string, number> = {
  td17g: 5,
  main: 30,
};

export const DEFAULT_AVG_SEC_PER_PAGE = 8;

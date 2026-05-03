'use client';

/**
 * F8-Sprint4: re-export общего компонента из @/components/ismeta. Сам
 * компонент переехал в shared-директорию для переиспользования в админке.
 */
export {
  default,
  default as ProgressView,
  type ProgressViewProps,
  PIPELINE_AVG_SEC_PER_PAGE,
  DEFAULT_AVG_SEC_PER_PAGE,
} from '@/components/ismeta/ProgressView';

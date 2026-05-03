/**
 * Типы публичного API распознавания спецификаций (hvac-info.com/ismeta).
 * Endpoint prefix: /api/hvac/ismeta (Next.js rewrite на backend
 * /api/hvac/ismeta).
 *
 * Не путать с `hvac-ismeta.ts` — там админский singleton настроек ERP.
 */

export type IsmetaPipelineId = 'main' | 'td17g';

export interface IsmetaPipelineOption {
  id: IsmetaPipelineId | string;
  label: string;
  description?: string;
  default?: boolean;
}

export interface IsmetaLlmProfileOption {
  id: number;
  name: string;
  vision: boolean;
  default?: boolean;
}

export interface IsmetaOptions {
  pipelines: IsmetaPipelineOption[];
  llm_profiles: IsmetaLlmProfileOption[];
}

export type IsmetaJobStatus =
  | 'queued'
  | 'processing'
  | 'done'
  | 'error'
  | 'cancelled';

/**
 * F8-Sprint4: фазы recognition'а, которые отдаёт live-progress в Redis.
 * UI рисует чек-лист по этой последовательности (queued → done).
 */
export type IsmetaProgressPhase =
  | ''
  | 'queued'
  | 'extract'
  | 'tabletransformer'
  | 'camelot'
  | 'vision_llm'
  | 'llm_normalize'
  | 'merge'
  | 'done'
  // backend кладёт error/cancelled в phase когда status терминальный
  | 'error'
  | 'cancelled';

export interface IsmetaJobProgress {
  status: IsmetaJobStatus;
  pages_total: number;
  pages_processed: number;
  items_count: number;
  error_message: string;
  /** F8-Sprint4 — все поля ниже опциональны (legacy backend без Redis вернёт ''). */
  phase?: IsmetaProgressPhase;
  current_page_label?: string;
  elapsed_seconds?: number | null;
  eta_seconds?: number | null;
  last_event_ts?: string | null;
}

/**
 * Item в результате — структура соответствует recognition.SpecItem
 * (см. backend/hvac_ismeta/excel.py COLUMNS). Все поля опциональные:
 * recognition может не вытащить часть на сложных PDF.
 */
export interface IsmetaItem {
  /** Номер позиции (sort_order в recognition). */
  sort_order?: number | string;
  /** Раздел спецификации. */
  section_name?: string;
  /** Наименование. */
  name?: string;
  /** Тип / марка / модель. */
  model_name?: string;
  /** Бренд. */
  brand?: string;
  /** Производитель. */
  manufacturer?: string;
  /** Единица измерения. */
  unit?: string;
  /** Количество. */
  quantity?: number | string;
  /** Страница в исходном PDF. */
  page_number?: number;
}

export interface IsmetaPagesStats {
  total: number;
  processed: number;
  skipped: number;
}

export interface IsmetaJobResult {
  items: IsmetaItem[];
  pages_stats: IsmetaPagesStats;
  cost_usd: number;
}

export interface IsmetaParseRequest {
  pipeline?: IsmetaPipelineId | string;
  llm_profile_id?: number;
  email?: string;
}

export interface IsmetaParseResponse {
  job_id: string;
}

export interface IsmetaFeedbackRequest {
  job_id: string;
  helpful: boolean;
  comment?: string;
  contact_email?: string;
}

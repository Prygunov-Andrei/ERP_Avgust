/**
 * Типы публичного API распознавания спецификаций (hvac-info.com/ismeta).
 * Endpoint prefix: /api/hvac/ismeta (через Next.js rewrite на backend
 * /api/v1/hvac/public/ismeta).
 *
 * Не путать с `hvac-ismeta.ts` — там админский singleton настроек ERP.
 */

export type IsmetaPipelineId = 'main' | 'td17g';

export interface IsmetaPipelineOption {
  id: IsmetaPipelineId | string;
  label: string;
  /** Краткая подсказка под select'ом / в tooltip. */
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

export interface IsmetaJobProgress {
  status: IsmetaJobStatus;
  pages_total: number;
  pages_processed: number;
  items_count: number;
  error_message: string;
}

export interface IsmetaItem {
  /** Номер позиции в спецификации (как в исходном PDF). */
  position: number | string;
  /** Наименование. */
  name: string;
  /** Тип / марка / модель. */
  model: string;
  /** Количество. */
  qty: number | string;
  /** Единица измерения (шт, м, м³, ...). */
  unit: string;
  /** Доп. характеристики, если есть. */
  specs?: string;
  /** Производитель. */
  manufacturer?: string;
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

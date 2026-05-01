/**
 * Типы настроек публичного сайта ISMeta (hvac-info.com/ismeta).
 * Зеркалирует backend/hvac_ismeta/serializers.py.
 */

export type HvacIsmetaPipeline = 'main' | 'td17g';

export interface HvacIsmetaSettings {
  id: number;
  enabled: boolean;
  default_pipeline: HvacIsmetaPipeline;
  default_llm_profile_id: number | null;
  concurrency_limit_enabled: boolean;
  pdf_storage_path: string;
  require_registration: boolean;
  max_file_size_mb: number;
  feedback_email: string;
  updated_at: string;
}

export type HvacIsmetaSettingsUpdate = Partial<
  Omit<HvacIsmetaSettings, 'id' | 'updated_at'>
>;

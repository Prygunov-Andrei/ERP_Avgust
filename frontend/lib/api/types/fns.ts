// ─── API-FNS Types ──────────────────────────────────────────────

export interface FNSSuggestResult {
  inn: string;
  name: string;
  short_name: string;
  kpp: string;
  ogrn: string;
  address: string;
  legal_form: string;
  status: string;
  registration_date: string;
  is_local: boolean;
  local_id: number | null;
}

export interface FNSSuggestResponse {
  source: 'local' | 'fns' | 'mixed';
  results: FNSSuggestResult[];
  total: number;
  error?: string;
}

export interface FNSReport {
  id: number;
  counterparty: number;
  counterparty_name: string;
  report_type: 'check' | 'egr' | 'bo';
  report_type_display: string;
  inn: string;
  report_date: string;
  data: Record<string, unknown>;
  summary: Record<string, unknown> | null;
  requested_by: number | null;
  requested_by_username: string | null;
  created_at: string;
}

export interface FNSReportListItem {
  id: number;
  counterparty: number;
  counterparty_name: string;
  report_type: 'check' | 'egr' | 'bo';
  report_type_display: string;
  inn: string;
  report_date: string;
  summary: Record<string, unknown> | null;
  requested_by_username: string | null;
  created_at: string;
}

export interface FNSReportCreateResponse {
  reports: FNSReport[];
  created_count: number;
  errors?: Array<{ report_type: string; error: string }>;
}

export interface FNSStatsMethod {
  name: string;
  display_name: string;
  limit: number;
  used: number;
  remaining: number;
}

export interface FNSStats {
  is_configured: boolean;
  status: string;
  start_date: string;
  end_date: string;
  methods: FNSStatsMethod[];
  error?: string;
}

export interface FNSQuickCheckResponse {
  inn: string;
  summary: {
    positive: string[];
    negative: string[];
    positive_count: number;
    negative_count: number;
    risk_level: 'low' | 'medium' | 'high' | 'unknown';
  };
  raw_data: Record<string, unknown>;
}

export interface FNSEnrichResponse {
  inn: string;
  name: string;
  short_name: string;
  kpp: string;
  ogrn: string;
  address: string;
  legal_form: string;
  status: string;
  registration_date: string;
  director: string;
  okved: string;
  okved_name: string;
  capital: string;
  contact_info: string;
  error?: string;
}

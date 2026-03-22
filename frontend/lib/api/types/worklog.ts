// =============================================================================
// Worklog Types (Сервис фиксации работ)
// =============================================================================

export interface WorklogShift {
  id: string;
  contract: number | null;
  contract_number: string | null;
  contract_name: string | null;
  object: number;
  object_name: string;
  contractor: number;
  contractor_name: string;
  date: string;
  shift_type: 'day' | 'evening' | 'night';
  start_time: string;
  end_time: string;
  qr_token: string;
  status: 'scheduled' | 'active' | 'closed';
  registrations_count: number;
  teams_count: number;
}

export interface WorklogTeam {
  id: string;
  object_name: string;
  shift: string;
  topic_name: string;
  brigadier_name: string | null;
  status: 'active' | 'closed';
  is_solo: boolean;
  media_count: number;
}

export interface WorklogMedia {
  id: string;
  team: string | null;
  team_name: string | null;
  author_name: string;
  media_type: 'photo' | 'video' | 'audio' | 'voice' | 'document' | 'text';
  tag: string;
  file_url: string;
  thumbnail_url: string;
  text_content: string;
  status: string;
  created_at: string;
}

export interface WorklogReport {
  id: string;
  team: string;
  team_name: string | null;
  shift: string;
  report_number: number;
  report_type: 'intermediate' | 'final' | 'supplement';
  media_count: number;
  status: string;
  created_at: string;
}

export interface WorkJournalSummary {
  total_shifts: number;
  active_shifts: number;
  total_teams: number;
  total_media: number;
  total_reports: number;
  total_workers: number;
  recent_shifts: WorklogShift[];
}

export interface WorklogReportDetail extends WorklogReport {
  trigger: string;
  media_items: WorklogMedia[];
  questions: WorklogQuestion[];
}

export interface WorklogQuestion {
  id: string;
  report: string;
  author: string;
  author_name: string;
  text: string;
  status: 'pending' | 'answered';
  created_at: string;
  answers: WorklogAnswer[];
}

export interface WorklogAnswer {
  id: string;
  question: string;
  author: string;
  author_name: string;
  text: string;
  created_at: string;
}

export interface WorklogSupergroup {
  id: string;
  object: number;
  object_name: string;
  contractor: number;
  contractor_name: string;
  telegram_chat_id: number;
  chat_title: string;
  invite_link: string;
  is_active: boolean;
  created_at: string;
}

export interface InviteToken {
  id: string;
  code: string;
  contractor: number;
  contractor_name: string;
  created_by: number | null;
  created_by_username: string | null;
  role: string;
  expires_at: string;
  used: boolean;
  used_by: string | null;
  used_by_name: string | null;
  used_at: string | null;
  bot_link: string;
  is_valid: boolean;
  created_at: string;
}

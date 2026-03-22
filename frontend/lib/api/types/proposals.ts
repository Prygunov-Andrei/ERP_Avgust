import type { MountingCondition } from './estimates';

// ТКП - Технико-Коммерческие Предложения
export type TKPStatus = 'draft' | 'in_progress' | 'checking' | 'approved' | 'sent';

export interface TechnicalProposalListItem {
  id: number;
  number: string;
  outgoing_number: string | null;
  name: string;
  date: string;
  due_date: string | null;
  object: number;
  object_name: string;
  object_address: string;
  object_area: number | null;
  legal_entity: number;
  legal_entity_name: string;
  status: TKPStatus;
  validity_days: number;
  validity_date: string;
  created_by: number;
  created_by_name: string;
  checked_by: number | null;
  approved_by: number | null;
  approved_at: string | null;
  total_amount: string;
  total_with_vat: string;
  version_number: number;
  parent_version: number | null;
  created_at: string;
  updated_at: string;
}

export interface TKPEstimateSubsection {
  id: number;
  section: number;
  source_subsection: number | null;
  name: string;
  materials_sale: string;
  works_sale: string;
  materials_purchase: string;
  works_purchase: string;
  sort_order: number;
  total_sale: string;
  total_purchase: string;
  created_at: string;
}

export interface TKPEstimateSection {
  id: number;
  tkp: number;
  source_estimate: number | null;
  source_section: number | null;
  name: string;
  sort_order: number;
  subsections: TKPEstimateSubsection[];
  total_sale: string;
  total_purchase: string;
  profit: string;
  estimate_name: string | null;
  estimate_number: string | null;
  created_at: string;
}

export interface TKPCharacteristic {
  id: number;
  tkp: number;
  source_estimate: number | null;
  source_characteristic: number | null;
  name: string;
  purchase_amount: string;
  sale_amount: string;
  sort_order: number;
  created_at: string;
}

export interface TKPFrontOfWork {
  id: number;
  tkp: number;
  front_item: number;
  front_item_name: string;
  front_item_category: string;
  when_text: string;
  when_date: string | null;
  sort_order: number;
  created_at: string;
}

export interface TKPStatusHistoryItem {
  id: number;
  old_status: string;
  new_status: string;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_at: string;
  comment: string;
}

export interface TechnicalProposalDetail extends TechnicalProposalListItem {
  advance_required: string;
  work_duration: string;
  notes: string;
  estimates: number[];
  estimate_sections: TKPEstimateSection[];
  characteristics: TKPCharacteristic[];
  front_of_work: TKPFrontOfWork[];
  total_profit: string;
  profit_percent: string;
  total_man_hours: string;
  currency_rates: {
    usd: string | null;
    eur: string | null;
    cny: string | null;
  };
  file_url: string | null;
  versions_count: number;
  is_latest_version: boolean;
  signatory_name: string;
  signatory_position: string;
  checked_by_name: string | null;
  approved_by_name: string | null;
  checked_at: string | null;
  status_history: TKPStatusHistoryItem[];
}

// МП - Монтажные Предложения
export type MPStatus = 'draft' | 'published' | 'sent' | 'approved' | 'rejected';

export interface MountingProposalListItem {
  id: number;
  number: string;
  name: string;
  date: string;
  object: number;
  object_name: string;
  counterparty: number | null;
  counterparty_name: string | null;
  parent_tkp: number | null;
  parent_tkp_number: string | null;
  mounting_estimates: number[];
  total_amount: string;
  man_hours: string;
  status: MPStatus;
  telegram_published: boolean;
  telegram_published_at: string | null;
  created_by: number;
  created_by_name: string;
  version_number: number;
  parent_version: number | null;
  created_at: string;
  updated_at: string;
}

export interface MountingProposalDetail extends MountingProposalListItem {
  notes: string;
  conditions: MountingCondition[];
  conditions_ids: number[];
  mounting_estimates_ids: number[];
  file_url: string | null;
  versions_count: number;
  parent_tkp_name: string | null;
}

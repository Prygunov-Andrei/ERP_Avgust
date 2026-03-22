// ============================================
// Pricelis Interfaces
// ============================================

export interface WorkerGrade {
  id: number;
  grade: number; // 1-5
  name: string;
  default_hourly_rate: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerGradeData {
  grade: number;
  name: string;
  default_hourly_rate: string;
  is_active?: boolean;
}

export interface WorkSection {
  id: number;
  code: string;
  name: string;
  parent: number | null;
  parent_name?: string | null;
  is_active: boolean;
  sort_order: number;
  children?: WorkSection[];
  created_at: string;
  updated_at: string;
}

export interface CreateWorkSectionData {
  code: string;
  name: string;
  parent?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface WorkerGradeSkills {
  id: number;
  grade: number;
  grade_detail?: {
    id: number;
    grade: number;
    name: string;
  };
  section: number;
  section_detail?: {
    id: number;
    code: string;
    name: string;
  };
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerGradeSkillsData {
  grade: number;
  section: number;
  description: string;
}

// Work Items
export interface WorkItemList {
  id: number;
  article: string; // "V-001" (генерируется автоматически)
  section: number;
  section_name: string;
  name: string;
  unit: 'шт' | 'м.п.' | 'м²' | 'м³' | 'компл' | 'ед' | 'ч' | 'кг' | 'т' | 'точка';
  hours: string | null; // Часы (опционально, null = 0)
  grade: number; // ID разряда из справочника
  grade_name: string;
  required_grade: string; // Фактический числовой разряд (может быть дробным: "3.50", "2.50", "4.00")
  coefficient: string;
  version_number: number;
  is_current: boolean;
  comment?: string; // Комментарий к работе (опционально)
}

export interface WorkItemDetail extends WorkItemList {
  section_detail: WorkSection;
  grade_detail: WorkerGrade;
  composition: string;
  parent_version: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkItemData {
  section: number;
  name: string;
  unit: 'шт' | 'м.п.' | 'м²' | 'м³' | 'компл' | 'ед' | 'ч' | 'кг' | 'т' | 'точка';
  hours?: string | null; // Часы (опционально, если не указано, бэкенд подставит 0)
  grade: string; // Разряд как строка для поддержки дробных значений (например, "2.5", "3.65")
  coefficient: string;
  composition?: string;
  comment?: string; // Комментарий к работе (опционально)
}

// Price Lists
export interface PriceListList {
  id: number;
  number: string;
  name: string;
  date: string; // YYYY-MM-DD
  status: 'draft' | 'active' | 'archived';
  status_display: string;
  version_number: number;
  items_count: number;
  agreements_count: number;
  created_at: string;
  updated_at: string;
}

export interface PriceListItem {
  id: number;
  price_list: number;
  work_item: number;
  work_item_detail: {
    id: number;
    article: string;
    section_name: string;
    name: string;
    unit: string; // Сокращенное значение единицы измерения: "шт", "м.п.", "компл", "м²", "точка", "кг"
    hours: string;
    grade: number;
    grade_name: string;
    coefficient: string;
  };
  hours_override: string | null;
  coefficient_override: string | null;
  grade_override: string | null; // Переопределённый разряд (может быть дробным)
  effective_hours: string;
  effective_coefficient: string;
  effective_grade: string; // Read-only: эффективный разряд (grade_override || work_item.grade.grade)
  calculated_cost: string;
  is_included: boolean;
  created_at: string;
}

export interface PriceListAgreement {
  id: number;
  price_list: number;
  counterparty: number;
  counterparty_detail: {
    id: number;
    name: string;
    inn: string;
  };
  agreed_date: string;
  notes: string;
  created_at: string;
}

export interface PriceListDetail {
  id: number;
  number: string;
  name: string;
  date: string;
  status: 'draft' | 'active' | 'archived';
  status_display: string;
  grade_1_rate: string;
  grade_2_rate: string;
  grade_3_rate: string;
  grade_4_rate: string;
  grade_5_rate: string;
  version_number: number;
  parent_version: number | null;
  items: PriceListItem[];
  agreements: PriceListAgreement[];
  items_count: number;
  total_cost: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePriceListData {
  number: string;
  name?: string;
  date: string; // YYYY-MM-DD
  status?: 'draft' | 'active' | 'archived';
  grade_1_rate: string;
  grade_2_rate: string;
  grade_3_rate: string;
  grade_4_rate: string;
  grade_5_rate: string;
  work_items?: number[];
  populate_rates?: boolean;
}

export interface UpdatePriceListItemData {
  hours_override?: string | null;
  coefficient_override?: string | null;
  grade_override?: string | null; // Переопределённый разряд (может быть дробным)
  is_included?: boolean;
}

export interface CreatePriceListItemData {
  price_list: number;
  work_item: number;
  hours_override?: string | null;
  coefficient_override?: string | null;
  grade_override?: string | null; // Переопределённый разряд (может быть дробным)
  is_included?: boolean;
}

export interface CreatePriceListAgreementData {
  price_list: number;
  counterparty: number;
  agreed_date: string;
  notes?: string;
}

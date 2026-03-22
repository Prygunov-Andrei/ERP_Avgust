// =====================================================================
// PERSONNEL TYPES (Персонал)
// =====================================================================

export interface ERPPermissionChild {
  code: string;
  label: string;
}

export interface ERPPermissionSection {
  code: string;
  label: string;
  children: ERPPermissionChild[];
}

export const ERP_PERMISSION_TREE: ERPPermissionSection[] = [
  { code: 'dashboard', label: 'Пункт управления', children: [] },
  { code: 'commercial', label: 'Коммерческие предложения', children: [
    { code: 'kanban', label: 'Канбан КП' },
    { code: 'tkp', label: 'ТКП' },
    { code: 'mp', label: 'МП' },
    { code: 'estimates', label: 'Сметы' },
  ]},
  { code: 'objects', label: 'Объекты', children: [] },
  { code: 'finance', label: 'Финансы', children: [
    { code: 'dashboard', label: 'Дашборд' },
    { code: 'payments', label: 'Платежи' },
    { code: 'statements', label: 'Выписки' },
    { code: 'recurring', label: 'Периодические платежи' },
    { code: 'debtors', label: 'Дебиторская задолженность' },
    { code: 'accounting', label: 'Бухгалтерия' },
    { code: 'budget', label: 'Расходный бюджет' },
    { code: 'indicators', label: 'Финансовые показатели' },
  ]},
  { code: 'contracts', label: 'Договоры', children: [
    { code: 'framework', label: 'Рамочные договоры' },
    { code: 'object_contracts', label: 'Договоры по объектам' },
    { code: 'estimates', label: 'Сметы' },
    { code: 'mounting_estimates', label: 'Монтажные сметы' },
    { code: 'acts', label: 'Акты' },
    { code: 'household', label: 'Хозяйственные договоры' },
  ]},
  { code: 'supply', label: 'Снабжение и Склад', children: [
    { code: 'kanban', label: 'Канбан снабжения' },
    { code: 'invoices', label: 'Счета на оплату' },
    { code: 'drivers', label: 'Календарь водителей' },
    { code: 'moderation', label: 'Модерация товаров' },
    { code: 'warehouse', label: 'Склад' },
  ]},
  { code: 'goods', label: 'Товары и услуги', children: [
    { code: 'categories', label: 'Категории' },
    { code: 'catalog', label: 'Номенклатура' },
    { code: 'moderation', label: 'Модерация' },
    { code: 'works', label: 'Каталог работ' },
    { code: 'pricelists', label: 'Прайс-листы' },
    { code: 'grades', label: 'Разряды монтажников' },
  ]},
  { code: 'pto', label: 'ПТО', children: [
    { code: 'projects', label: 'Проекты' },
    { code: 'production', label: 'Производственная документация' },
    { code: 'executive', label: 'Исполнительная документация' },
    { code: 'samples', label: 'Образцы документов' },
    { code: 'knowledge', label: 'Руководящие документы' },
  ]},
  { code: 'marketing', label: 'Маркетинг', children: [
    { code: 'kanban', label: 'Канбан поиска объектов' },
    { code: 'potential_customers', label: 'Потенциальные заказчики' },
    { code: 'executors', label: 'Поиск исполнителей' },
  ]},
  { code: 'communications', label: 'Переписка', children: [] },
  { code: 'settings', label: 'Справочники и настройки', children: [
    { code: 'work_conditions', label: 'Фронт работ и монтажные условия' },
    { code: 'personnel', label: 'Персонал' },
    { code: 'counterparties', label: 'Контрагенты' },
    { code: 'config', label: 'Настройки' },
  ]},
  { code: 'help', label: 'Справка', children: [] },
  { code: 'finance_approve', label: 'Одобрение платежей', children: [] },
  { code: 'supply_approve', label: 'Одобрение счетов', children: [] },
  { code: 'kanban_admin', label: 'Администрирование канбана', children: [] },
];

export type ERPPermissionLevel = 'none' | 'read' | 'edit';
export type ERPPermissions = Record<string, ERPPermissionLevel>;

export interface EmployeeBrief {
  id: number;
  full_name: string;
  current_position: string;
}

export interface PositionRecord {
  id: number;
  employee: number;
  legal_entity: number;
  legal_entity_name: string;
  position_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  order_number: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryHistoryRecord {
  id: number;
  employee: number;
  salary_full: string;
  salary_official: string;
  effective_date: string;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: number;
  full_name: string;
  date_of_birth: string | null;
  gender: 'M' | 'F' | '';
  current_position: string;
  hire_date: string | null;
  salary_full: string;
  salary_official: string;
  is_active: boolean;
  user?: number | null;
  current_legal_entities: Array<{
    id: number;
    short_name: string;
    position_title: string;
  }>;
  supervisors_brief: EmployeeBrief[];
  created_at: string;
  updated_at: string;
}

export interface EmployeeDetail extends Employee {
  responsibilities: string;
  bank_name: string;
  bank_bik: string;
  bank_corr_account: string;
  bank_account: string;
  bank_card_number: string;
  user: number | null;
  user_username: string | null;
  counterparty: number | null;
  counterparty_name: string | null;
  subordinates_brief: EmployeeBrief[];
  erp_permissions: ERPPermissions;
  positions: PositionRecord[];
  salary_history: SalaryHistoryRecord[];
}

export interface CreateEmployeeData {
  full_name: string;
  date_of_birth?: string | null;
  gender?: 'M' | 'F' | '';
  current_position?: string;
  hire_date?: string | null;
  salary_full?: number;
  salary_official?: number;
  responsibilities?: string;
  bank_name?: string;
  bank_bik?: string;
  bank_corr_account?: string;
  bank_account?: string;
  bank_card_number?: string;
  user?: number | null;
  counterparty?: number | null;
  supervisor_ids?: number[];
  erp_permissions?: ERPPermissions;
  is_active?: boolean;
}

export interface CreatePositionRecordData {
  legal_entity: number;
  position_title: string;
  start_date: string;
  end_date?: string | null;
  is_current?: boolean;
  order_number?: string;
  notes?: string;
}

export interface CreateSalaryRecordData {
  salary_full: number;
  salary_official: number;
  effective_date: string;
  reason?: string;
}

export interface OrgChartNode {
  id: number;
  full_name: string;
  current_position: string;
  is_active: boolean;
  legal_entities: Array<{
    id: number;
    short_name: string;
    position_title: string;
  }>;
}

export interface OrgChartEdge {
  source: number;
  target: number;
}

export interface OrgChartData {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
}

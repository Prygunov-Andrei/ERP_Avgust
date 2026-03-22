import type { PaymentItem } from '../../../types/catalog';

export interface PaymentRegistryItem {
  id: number;

  // Ссылки (Read-only)
  contract_number?: string;
  contract_name?: string;
  category_name?: string;
  account_name?: string;
  act_number?: string;

  planned_date: string;
  amount: string;
  status: 'planned' | 'approved' | 'paid' | 'cancelled';
  status_display?: string;

  initiator?: string;
  approved_by_name?: string;
  approved_at?: string;

  comment?: string;
  invoice_file?: string; // URL файла

  payment_id?: number; // ID связанного платежа

  created_at: string;
  updated_at: string;
}

export interface CreatePaymentRegistryData {
  category_id: number;
  contract_id?: number;
  act_id?: number;
  account_id?: number;
  planned_date: string;
  amount: string;
  comment?: string;
  invoice_file?: File;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  code?: string;
  parent?: number;
  parent_name?: string;
  account_type?: string;
  requires_contract: boolean;
  is_active: boolean;
  sort_order: number;
  children?: ExpenseCategory[];
}

export interface CreateExpenseCategoryData {
  name: string;
  code?: string;
  parent?: number | null;
  requires_contract?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export interface CashFlowData {
  month: string;
  income: number;
  expense: number;
}

export interface ObjectCashFlowData {
  date: string;
  income: number;
  expense: number;
  net: number;
}

export interface DebtSummary {
  total_receivables: number;
  total_payables: number;
}

export interface ActPaymentAllocation {
  id: number;
  act: number;
  payment: number;
  payment_description: string;
  payment_date: string;
  amount: string;
  created_at: string;
}

// ============================================
// Payments Interfaces
// ============================================

export interface Payment {
  id: number;
  account: number; // ID счёта
  account_name?: string; // Read-only
  contract?: number; // ID договора
  contract_name?: string; // Read-only
  contract_number?: string; // Read-only
  contract_display?: string; // Read-only: отображаемое имя
  category: number; // ID категории
  category_name?: string; // Read-only
  category_full_path?: string; // Read-only: полный путь категории
  legal_entity: number; // ID юрлица
  legal_entity_name?: string; // Read-only
  payment_type: 'income' | 'expense';
  payment_date: string; // YYYY-MM-DD
  amount: string; // Decimal string (для обратной совместимости, равен amount_gross)
  amount_gross: string; // Decimal string: сумма с НДС
  amount_net: string; // Decimal string: сумма без НДС
  vat_amount: string; // Decimal string: сумма НДС
  status: 'pending' | 'paid' | 'cancelled';
  description?: string;
  scan_file: string; // URL файла (ОБЯЗАТЕЛЬНЫЙ!)
  payment_registry?: number; // ID заявки в реестре (только для expense)
  is_internal_transfer: boolean;
  internal_transfer_group: string | null; // Группа для связывания внутренних переводов
  items?: PaymentItem[]; // Позиции товаров (только для expense)
  items_count?: number; // Количество позиций
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentData {
  payment_type: 'income' | 'expense';
  account_id: number;
  category_id: number;
  payment_date: string;
  amount_gross: string;
  amount_net?: string; // Рассчитывается автоматически, но можно переопределить
  vat_amount?: string; // Рассчитывается автоматически, но можно переопределить
  contract_id?: number;
  legal_entity_id?: number;
  description?: string;
  scan_file: File; // ОБЯЗАТЕЛЬНЫЙ PDF
  is_internal_transfer?: boolean;
  internal_transfer_group?: string;
  items_input?: Array<{
    raw_name: string;
    quantity: string;
    unit: string;
    price_per_unit: string;
    vat_amount?: string;
  }>; // Позиции товаров (только для expense)
}

// ============================================
// Correspondence Interfaces
// ============================================

export interface Correspondence {
  id: number;
  contract: number; // ID договора
  contract_number?: string; // Read-only
  contract_name?: string; // Read-only
  type: 'incoming' | 'outgoing';
  category: 'уведомление' | 'претензия' | 'запрос' | 'ответ' | 'прочее';
  number: string;
  date: string; // YYYY-MM-DD
  status: 'новое' | 'в работе' | 'отвечено' | 'закрыто';
  subject: string;
  description?: string;
  file?: string; // URL файла
  related_to?: number; // ID связанного письма
  related_to_number?: string; // Read-only
  created_at: string;
  updated_at: string;
}

export interface CreateCorrespondenceData {
  contract: number;
  type: 'incoming' | 'outgoing';
  category: 'уведомление' | 'претензия' | 'запрос' | 'ответ' | 'прочее';
  number: string;
  date: string;
  status?: 'новое' | 'в работе' | 'отвечено' | 'закрыто';
  subject: string;
  description?: string;
  file?: File;
  related_to?: number;
}

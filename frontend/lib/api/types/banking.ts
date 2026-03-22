// =========================================================================
// Banking Types
// =========================================================================

export interface BankConnection {
  id: number;
  name: string;
  legal_entity: number;
  legal_entity_name: string;
  provider: 'tochka';
  provider_display: string;
  payment_mode: 'for_sign' | 'auto_sign';
  payment_mode_display: string;
  customer_code: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export interface CreateBankConnectionData {
  name: string;
  legal_entity: number;
  provider?: string;
  client_id: string;
  client_secret: string;
  customer_code: string;
  payment_mode?: 'for_sign' | 'auto_sign';
  is_active?: boolean;
}

export interface BankAccount {
  id: number;
  account: number;
  account_name: string;
  account_number: string;
  bank_connection: number;
  connection_name: string;
  external_account_id: string;
  last_statement_date: string | null;
  sync_enabled: boolean;
  created_at: string;
}

export interface CreateBankAccountData {
  account: number;
  bank_connection: number;
  external_account_id: string;
  sync_enabled?: boolean;
}

export interface BankTransaction {
  id: number;
  bank_account: number;
  bank_account_name: string;
  external_id: string;
  transaction_type: 'incoming' | 'outgoing';
  transaction_type_display: string;
  amount: string;
  date: string;
  purpose: string;
  counterparty_name: string;
  counterparty_inn: string;
  counterparty_kpp: string;
  counterparty_account: string;
  counterparty_bank_name: string;
  counterparty_bik: string;
  counterparty_corr_account: string;
  document_number: string;
  payment: number | null;
  reconciled: boolean;
  created_at: string;
}

export interface BankPaymentOrder {
  id: number;
  bank_account: number;
  bank_account_name: string;
  payment_registry: number | null;
  recipient_name: string;
  recipient_inn: string;
  recipient_kpp?: string;
  recipient_account?: string;
  recipient_bank_name?: string;
  recipient_bik?: string;
  recipient_corr_account?: string;
  amount: string;
  purpose: string;
  vat_info: string;
  payment_date: string;
  original_payment_date: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent_to_bank' | 'pending_sign' | 'executed' | 'rejected' | 'failed';
  status_display: string;
  created_by: number;
  created_by_username: string;
  approved_by: number | null;
  approved_by_username: string;
  approved_at: string | null;
  sent_at: string | null;
  executed_at: string | null;
  error_message: string;
  reschedule_count: number;
  can_reschedule: boolean;
  created_at: string;
}

export interface CreateBankPaymentOrderData {
  bank_account: number;
  payment_registry?: number;
  recipient_name: string;
  recipient_inn: string;
  recipient_kpp?: string;
  recipient_account: string;
  recipient_bank_name: string;
  recipient_bik: string;
  recipient_corr_account?: string;
  amount: string;
  purpose: string;
  vat_info?: string;
  payment_date: string;
}

export interface BankPaymentOrderEvent {
  id: number;
  order: number;
  event_type: 'created' | 'submitted' | 'approved' | 'rejected' | 'rescheduled' | 'sent_to_bank' | 'executed' | 'failed' | 'comment';
  event_type_display: string;
  user: number | null;
  username: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  comment: string;
  created_at: string;
}

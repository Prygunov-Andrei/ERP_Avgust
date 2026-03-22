export interface LegalEntity {
  id: number;
  name: string;
  inn: string;
  tax_system: string | number | TaxSystem; // Может быть строкой, числом (ID) или объектом
  tax_system_id?: number;
  tax_system_details?: TaxSystem; // Детали системы налогообложения (has_vat, vat_rate)
  short_name?: string;
  kpp?: string;
  ogrn?: string;
  director?: number;
  director_name?: string;
  director_position?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Account {
  id: number;
  name: string;
  balance: string;
  currency: string;
  account_type: string;
  bank_name?: string;
  account_number?: string;
  number?: string;
  bic?: string;
  bik?: string;
  legal_entity?: number;
  legal_entity_name?: string;
  current_balance?: string;
  initial_balance?: string;
  balance_date?: string;
  bank_account_id?: number | null;
  bank_balance_latest?: string | null;
  bank_balance_date?: string | null;
  bank_delta?: string | null;
  location?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AccountBalance {
  id: number;
  account: number;
  balance_date: string;
  source?: 'internal' | 'bank_tochka';
  balance: string;
}

export interface Counterparty {
  id: number;
  name: string;
  short_name?: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  type: 'customer' | 'potential_customer' | 'vendor' | 'both' | 'employee' | 'supplier';
  vendor_subtype?: 'supplier' | 'executor' | 'both' | null;
  vendor_subtype_display?: string;
  legal_form?: string;
  address?: string;
  contact_info?: string;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface CounterpartyDuplicateItem {
  id: number;
  name: string;
  short_name?: string;
  inn: string;
  type: string;
  vendor_subtype?: string | null;
  legal_form?: string;
  kpp?: string;
  ogrn?: string;
  is_active?: boolean;
  _relations: {
    invoices_count: number;
    contracts_count: number;
    price_history_count: number;
  };
}

export interface CounterpartyDuplicateGroup {
  normalized_name: string;
  counterparties: CounterpartyDuplicateItem[];
  similarity: number;
}

export interface ConstructionObject {
  id: number;
  name: string;
  address: string;
  status: 'planned' | 'in_progress' | 'completed' | 'suspended';
  start_date: string | null;
  end_date: string | null;
  description?: string;
  photo?: string | null;
  contracts_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateConstructionObjectData {
  name: string;
  address: string;
  status: 'planned' | 'in_progress' | 'completed' | 'suspended';
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
}

export interface CreateCounterpartyData {
  name: string;
  short_name?: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  type: 'customer' | 'potential_customer' | 'vendor' | 'both' | 'employee' | 'supplier';
  vendor_subtype?: 'supplier' | 'executor' | 'both' | null;
  legal_form: string;
  address?: string;
  contact_info?: string;
  notes?: string;
}

export interface CreateLegalEntityData {
  name: string;
  inn: string;
  tax_system: number; // ID системы налогообложения
  short_name?: string;
  kpp?: string;
  ogrn?: string;
  director?: number;
  director_name?: string;
  director_position?: string;
}

export interface CreateAccountData {
  name: string;
  number: string;
  account_type: 'bank_account' | 'cash' | 'deposit' | 'currency_account';
  bank_name?: string;
  bik?: string;
  currency: string;
  initial_balance?: string;
  legal_entity: number;
  location?: string;
  description?: string;
}

export interface TaxSystem {
  id: number;
  name: string;
  code: string;
  vat_rate?: string;
  has_vat: boolean;
  description?: string;
  is_active: boolean;
}

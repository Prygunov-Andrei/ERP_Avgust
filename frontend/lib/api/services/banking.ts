import type { RequestFn } from './types';
import type {
  BankAccount, BankConnection, BankPaymentOrder, BankPaymentOrderEvent,
  BankTransaction, CreateBankAccountData, CreateBankConnectionData,
  CreateBankPaymentOrderData, PaginatedResponse,
} from '../types';

export function createBankingService(request: RequestFn) {
  return {
    // Bank Connections
    async getBankConnections(): Promise<BankConnection[]> {
      const res = await request<PaginatedResponse<BankConnection> | BankConnection[]>('/bank-connections/');
      if (res && typeof res === 'object' && 'results' in res) return res.results;
      return res as BankConnection[];
    },

    async createBankConnection(data: CreateBankConnectionData): Promise<BankConnection> {
      return request<BankConnection>('/bank-connections/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateBankConnection(id: number, data: Partial<CreateBankConnectionData>): Promise<BankConnection> {
      return request<BankConnection>(`/bank-connections/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteBankConnection(id: number): Promise<void> {
      return request<void>(`/bank-connections/${id}/`, { method: 'DELETE' });
    },

    async testBankConnection(id: number): Promise<{ status: string; message: string }> {
      return request<{ status: string; message: string }>(`/bank-connections/${id}/test/`, { method: 'POST' });
    },

    async syncBankAccounts(connectionId: number): Promise<{ status: string; synced: number }> {
      return request<{ status: string; synced: number }>(`/bank-connections/${connectionId}/sync-accounts/`, { method: 'POST' });
    },

    // Bank Accounts
    async getBankAccounts(): Promise<BankAccount[]> {
      const res = await request<PaginatedResponse<BankAccount> | BankAccount[]>('/bank-accounts/');
      if (res && typeof res === 'object' && 'results' in res) return res.results;
      return res as BankAccount[];
    },

    async createBankAccount(data: CreateBankAccountData): Promise<BankAccount> {
      return request<BankAccount>('/bank-accounts/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateBankAccount(id: number, data: Partial<CreateBankAccountData>): Promise<BankAccount> {
      return request<BankAccount>(`/bank-accounts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteBankAccount(id: number): Promise<void> {
      return request<void>(`/bank-accounts/${id}/`, { method: 'DELETE' });
    },

    async syncBankStatements(bankAccountId: number, dateFrom?: string, dateTo?: string): Promise<{ status: string; new_transactions: number }> {
      return request<{ status: string; new_transactions: number }>(`/bank-accounts/${bankAccountId}/sync-statements/`, {
        method: 'POST',
        body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
      });
    },

    // Bank Transactions
    async getBankTransactions(params?: {
      bank_account?: number;
      transaction_type?: string;
      reconciled?: boolean;
      date?: string;
      search?: string;
      ordering?: string;
      page?: number;
    }): Promise<PaginatedResponse<BankTransaction>> {
      const qs = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            qs.set(key, String(value));
          }
        });
      }
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<PaginatedResponse<BankTransaction>>(`/bank-transactions/${query}`);
    },

    async reconcileBankTransaction(transactionId: number, paymentId: number): Promise<{ status: string }> {
      return request<{ status: string }>(`/bank-transactions/${transactionId}/reconcile/`, {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId }),
      });
    },

    // Bank Payment Orders
    async getBankPaymentOrders(params?: {
      status?: string;
      bank_account?: number;
      payment_date?: string;
      search?: string;
      ordering?: string;
      page?: number;
    }): Promise<PaginatedResponse<BankPaymentOrder>> {
      const qs = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            qs.set(key, String(value));
          }
        });
      }
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<PaginatedResponse<BankPaymentOrder>>(`/bank-payment-orders/${query}`);
    },

    async getBankPaymentOrder(id: number): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>(`/bank-payment-orders/${id}/`);
    },

    async createBankPaymentOrder(data: CreateBankPaymentOrderData): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>('/bank-payment-orders/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async submitBankPaymentOrder(id: number): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>(`/bank-payment-orders/${id}/submit/`, { method: 'POST' });
    },

    async approveBankPaymentOrder(id: number, data?: { payment_date?: string; comment?: string }): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>(`/bank-payment-orders/${id}/approve/`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      });
    },

    async rejectBankPaymentOrder(id: number, comment?: string): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>(`/bank-payment-orders/${id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' }),
      });
    },

    async rescheduleBankPaymentOrder(id: number, paymentDate: string, comment: string): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>(`/bank-payment-orders/${id}/reschedule/`, {
        method: 'POST',
        body: JSON.stringify({ payment_date: paymentDate, comment }),
      });
    },

    async executeBankPaymentOrder(id: number): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>(`/bank-payment-orders/${id}/execute/`, { method: 'POST' });
    },

    async checkBankPaymentOrderStatus(id: number): Promise<BankPaymentOrder> {
      return request<BankPaymentOrder>(`/bank-payment-orders/${id}/status/`);
    },

    async getBankPaymentOrderEvents(id: number): Promise<BankPaymentOrderEvent[]> {
      return request<BankPaymentOrderEvent[]>(`/bank-payment-orders/${id}/events/`);
    },
  };
}

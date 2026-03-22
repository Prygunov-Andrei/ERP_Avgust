import type { RequestFn } from './types';
import type {
  CashFlowData, CreateExpenseCategoryData, CreatePaymentData,
  CreatePaymentRegistryData, DebtSummary, ExpenseCategory,
  PaginatedResponse, Payment, PaymentRegistryItem,
} from '../types';

export function createPaymentsService(request: RequestFn) {
  return {
    // Payment Registry
    async getPaymentRegistry(page: number = 1, statusFilter?: string) {
      let url = `/payment-registry/?ordering=-id&page=${page}`;
      if (statusFilter && statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      const response = await request<PaginatedResponse<PaymentRegistryItem> | PaymentRegistryItem[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response;
      }
      return { results: response as PaymentRegistryItem[], count: (response as PaymentRegistryItem[]).length, next: null, previous: null };
    },

    async createPaymentRegistryItem(data: CreatePaymentRegistryData) {
      return request<PaymentRegistryItem>('/payment-registry/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async approvePaymentRegistryItem(id: number) {
      return request<PaymentRegistryItem>(`/payment-registry/${id}/approve/`, { method: 'POST' });
    },

    async payPaymentRegistryItem(id: number) {
      return request<PaymentRegistryItem>(`/payment-registry/${id}/pay/`, { method: 'POST' });
    },

    async cancelPaymentRegistryItem(id: number, reason?: string) {
      return request<PaymentRegistryItem>(`/payment-registry/${id}/cancel/`, {
        method: 'POST',
        body: reason ? JSON.stringify({ reason }) : undefined,
      });
    },

    // Payments
    async getPayments(params?: {
      payment_type?: 'income' | 'expense';
      contract?: number;
      account?: number;
      category?: number;
      status?: string;
      payment_date_from?: string;
      payment_date_to?: string;
      search?: string;
      is_internal_transfer?: boolean;
      internal_transfer_group?: string;
      ordering?: string;
      page?: number;
      page_size?: number;
    }) {
      const queryParams = new URLSearchParams();
      if (params?.payment_type) queryParams.append('payment_type', params.payment_type);
      if (params?.contract) queryParams.append('contract', params.contract.toString());
      if (params?.account) queryParams.append('account', params.account.toString());
      if (params?.category) queryParams.append('category', params.category.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.payment_date_from) queryParams.append('payment_date_from', params.payment_date_from);
      if (params?.payment_date_to) queryParams.append('payment_date_to', params.payment_date_to);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.is_internal_transfer !== undefined) queryParams.append('is_internal_transfer', params.is_internal_transfer.toString());
      if (params?.internal_transfer_group) queryParams.append('internal_transfer_group', params.internal_transfer_group);
      if (params?.ordering) queryParams.append('ordering', params.ordering);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

      const queryString = queryParams.toString();
      const endpoint = `/payments/${queryString ? `?${queryString}` : ''}`;

      const response = await request<PaginatedResponse<Payment> | Payment[]>(endpoint);
      if (response && typeof response === 'object' && 'results' in response) {
        return response;
      }
      return { results: response as Payment[], count: (response as Payment[]).length };
    },

    async createPayment(data: CreatePaymentData) {
      const formData = new FormData();
      formData.append('payment_type', data.payment_type);
      formData.append('account_id', data.account_id.toString());
      formData.append('category_id', data.category_id.toString());
      formData.append('payment_date', data.payment_date);
      formData.append('amount_gross', data.amount_gross);
      if (data.amount_net) formData.append('amount_net', data.amount_net);
      if (data.vat_amount) formData.append('vat_amount', data.vat_amount);
      if (data.contract_id) formData.append('contract_id', data.contract_id.toString());
      if (data.legal_entity_id) formData.append('legal_entity_id', data.legal_entity_id.toString());
      if (data.description) formData.append('description', data.description);
      formData.append('scan_file', data.scan_file);
      if (data.is_internal_transfer !== undefined) formData.append('is_internal_transfer', data.is_internal_transfer.toString());
      if (data.internal_transfer_group) formData.append('internal_transfer_group', data.internal_transfer_group);

      return request<Payment>('/payments/', {
        method: 'POST',
        body: formData,
      });
    },

    async updatePayment(id: number, data: Partial<CreatePaymentData>) {
      const formData = new FormData();
      if (data.account_id) formData.append('account_id', data.account_id.toString());
      if (data.contract_id) formData.append('contract_id', data.contract_id.toString());
      if (data.category_id) formData.append('category_id', data.category_id.toString());
      if (data.legal_entity_id) formData.append('legal_entity_id', data.legal_entity_id.toString());
      if (data.payment_type) formData.append('payment_type', data.payment_type);
      if (data.payment_date) formData.append('payment_date', data.payment_date);
      if (data.amount_gross) formData.append('amount_gross', data.amount_gross);
      if (data.amount_net) formData.append('amount_net', data.amount_net);
      if (data.vat_amount) formData.append('vat_amount', data.vat_amount);
      if (data.description) formData.append('description', data.description);
      if (data.scan_file) formData.append('scan_file', data.scan_file);
      if (data.is_internal_transfer !== undefined) formData.append('is_internal_transfer', data.is_internal_transfer.toString());
      if (data.internal_transfer_group) formData.append('internal_transfer_group', data.internal_transfer_group);

      return request<Payment>(`/payments/${id}/`, {
        method: 'PATCH',
        body: formData,
      });
    },

    async deletePayment(id: number) {
      return request<void>(`/payments/${id}/`, { method: 'DELETE' });
    },

    // Expense Categories
    async getExpenseCategories(tree: boolean = false, accountType?: string) {
      let url = tree ? '/expense-categories/?tree=true' : '/expense-categories/';
      if (accountType) url += (url.includes('?') ? '&' : '?') + `account_type=${accountType}`;
      const response = await request<PaginatedResponse<ExpenseCategory> | ExpenseCategory[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as ExpenseCategory[];
    },

    async createExpenseCategory(data: CreateExpenseCategoryData) {
      return request<ExpenseCategory>('/expense-categories/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateExpenseCategory(id: number, data: Partial<CreateExpenseCategoryData>) {
      return request<ExpenseCategory>(`/expense-categories/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteExpenseCategory(id: number) {
      return request(`/expense-categories/${id}/`, {
        method: 'DELETE',
      });
    },

    // Analytics
    async getCashFlow(period: string = 'year') {
      return request<CashFlowData[]>(`/analytics/cashflow/?period=${period}`);
    },

    async getDebtSummary() {
      return request<DebtSummary>('/analytics/debt_summary/');
    },
  };
}

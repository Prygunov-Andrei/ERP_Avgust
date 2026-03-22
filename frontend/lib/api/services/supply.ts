import type { RequestFn } from './types';
import type { PaginatedResponse } from '../types';
import type {
  AppNotification, BitrixIntegration, DashboardData, IncomeRecord,
  Invoice, InvoiceItem as SupplyInvoiceItem, RecurringPayment, SupplyRequest,
} from '../../../types/supply';
import type {
  SupplierIntegration, SupplierProduct, SupplierCategory,
  SupplierBrand, SupplierSyncLog, SupplierSyncStatus,
} from '../../../types/supplier';

// Portal types (no dedicated type file yet — lightweight inline interfaces)
interface PortalRequest {
  id: number;
  status: string;
  project_name?: string;
  company_name?: string;
  email?: string;
  total_spec_items?: number;
  matched_exact?: number;
  matched_analog?: number;
  unmatched?: number;
  created_at?: string;
  [key: string]: unknown;
}

interface PortalConfig {
  [key: string]: unknown;
}

interface PortalPricing {
  id: number;
  [key: string]: unknown;
}

interface PortalCallback {
  id: number;
  status: string;
  phone?: string;
  request_company?: string;
  request_email?: string;
  request_project?: string;
  comment?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface PortalStats {
  total_requests?: number;
  by_status?: Record<string, number>;
  downloaded_count?: number;
  callback_count?: number;
  total_llm_cost?: number;
  [key: string]: unknown;
}

interface BulkUploadSession {
  id: number;
  status: string;
  [key: string]: unknown;
}

export function createSupplyService(request: RequestFn) {
  return {
    // Notifications
    async getNotifications() {
      return request<AppNotification[]>('/notifications/');
    },
    async getUnreadNotificationCount() {
      return request<{ count: number }>('/notifications/unread_count/');
    },
    async markNotificationRead(id: number) {
      return request<{ status: string }>(`/notifications/${id}/mark_read/`, { method: 'POST' });
    },
    async markAllNotificationsRead() {
      return request<{ status: string }>('/notifications/mark_all_read/', { method: 'POST' });
    },

    // Supply Requests
    async getSupplyRequests(params?: string) {
      return request<PaginatedResponse<SupplyRequest>>(`/supply-requests/${params ? '?' + params : ''}`);
    },
    async getSupplyRequest(id: number) {
      return request<SupplyRequest>(`/supply-requests/${id}/`);
    },
    async updateSupplyRequest(id: number, data: Partial<SupplyRequest>) {
      return request<SupplyRequest>(`/supply-requests/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    // Bitrix Integrations
    async getBitrixIntegrations() {
      return request<BitrixIntegration[]>('/bitrix-integrations/');
    },
    async getBitrixIntegration(id: number) {
      return request<BitrixIntegration>(`/bitrix-integrations/${id}/`);
    },
    async createBitrixIntegration(data: Partial<BitrixIntegration>) {
      return request<BitrixIntegration>('/bitrix-integrations/', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateBitrixIntegration(id: number, data: Partial<BitrixIntegration>) {
      return request<BitrixIntegration>(`/bitrix-integrations/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async deleteBitrixIntegration(id: number) {
      return request<void>(`/bitrix-integrations/${id}/`, { method: 'DELETE' });
    },

    // Invoices
    async getInvoices(params?: string) {
      return request<PaginatedResponse<Invoice>>(`/invoices/${params ? '?' + params : ''}`);
    },
    async getInvoice(id: number) {
      return request<Invoice>(`/invoices/${id}/`);
    },
    async createInvoice(formData: FormData) {
      return request<Invoice>('/invoices/', {
        method: 'POST',
        body: formData,
        headers: {},
      });
    },
    async updateInvoice(id: number, data: Partial<Invoice>) {
      return request<Invoice>(`/invoices/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async verifyInvoice(id: number) {
      return request<Invoice>(`/invoices/${id}/verify/`, { method: 'POST' });
    },
    async submitInvoiceToRegistry(id: number) {
      return request<Invoice>(`/invoices/${id}/submit_to_registry/`, { method: 'POST' });
    },
    async approveInvoice(id: number, comment?: string) {
      return request<Invoice>(`/invoices/${id}/approve/`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || '' }),
      });
    },
    async rejectInvoice(id: number, comment: string) {
      return request<Invoice>(`/invoices/${id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
    },
    async rescheduleInvoice(id: number, newDate: string, comment: string) {
      return request<Invoice>(`/invoices/${id}/reschedule/`, {
        method: 'POST',
        body: JSON.stringify({ new_date: newDate, comment }),
      });
    },
    async markCashPaid(id: number) {
      return request<Invoice>(`/invoices/${id}/mark-cash-paid/`, { method: 'POST' });
    },
    async getInvoiceDashboard() {
      return request<DashboardData>('/invoices/dashboard/');
    },
    async bulkUploadInvoices(formData: FormData) {
      return request<BulkUploadSession>('/invoices/bulk-upload/', {
        method: 'POST',
        body: formData,
        headers: {},
      });
    },
    async getBulkSessionStatus(sessionId: number) {
      return request<BulkUploadSession>(`/invoices/bulk-sessions/${sessionId}/`);
    },

    // Invoice Items
    async createInvoiceItem(data: { invoice: number; raw_name: string; quantity: string; unit: string; price_per_unit: string; amount: string }) {
      return request<SupplyInvoiceItem>('/invoice-items/', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateInvoiceItem(id: number, data: Record<string, unknown>) {
      return request<SupplyInvoiceItem>(`/invoice-items/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async deleteInvoiceItem(id: number) {
      return request<void>(`/invoice-items/${id}/`, { method: 'DELETE' });
    },
    async deleteInvoice(id: number) {
      return request<void>(`/invoices/${id}/`, { method: 'DELETE' });
    },

    // Recurring Payments
    async getRecurringPayments(params?: string) {
      return request<PaginatedResponse<RecurringPayment>>(`/recurring-payments/${params ? '?' + params : ''}`);
    },
    async getRecurringPayment(id: number) {
      return request<RecurringPayment>(`/recurring-payments/${id}/`);
    },
    async createRecurringPayment(data: Partial<RecurringPayment>) {
      return request<RecurringPayment>('/recurring-payments/', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateRecurringPayment(id: number, data: Partial<RecurringPayment>) {
      return request<RecurringPayment>(`/recurring-payments/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async deleteRecurringPayment(id: number) {
      return request<void>(`/recurring-payments/${id}/`, { method: 'DELETE' });
    },

    // Income Records
    async getIncomeRecords(params?: string) {
      return request<PaginatedResponse<IncomeRecord>>(`/income-records/${params ? '?' + params : ''}`);
    },
    async createIncomeRecord(data: Partial<IncomeRecord>) {
      return request<IncomeRecord>('/income-records/', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateIncomeRecord(id: number, data: Partial<IncomeRecord>) {
      return request<IncomeRecord>(`/income-records/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async deleteIncomeRecord(id: number) {
      return request<void>(`/income-records/${id}/`, { method: 'DELETE' });
    },

    // Supplier Integrations
    async getSupplierIntegrations() {
      return request<PaginatedResponse<SupplierIntegration>>('/supplier-integrations/');
    },
    async getSupplierIntegration(id: number) {
      return request<SupplierIntegration>(`/supplier-integrations/${id}/`);
    },
    async createSupplierIntegration(data: Partial<SupplierIntegration>) {
      return request<SupplierIntegration>('/supplier-integrations/', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateSupplierIntegration(id: number, data: Partial<SupplierIntegration>) {
      return request<SupplierIntegration>(`/supplier-integrations/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async deleteSupplierIntegration(id: number) {
      return request<void>(`/supplier-integrations/${id}/`, { method: 'DELETE' });
    },
    async syncSupplierCatalog(id: number) {
      return request<{ status: string; task_id?: string }>(`/supplier-integrations/${id}/sync-catalog/`, { method: 'POST' });
    },
    async syncSupplierStock(id: number) {
      return request<{ status: string; task_id?: string }>(`/supplier-integrations/${id}/sync-stock/`, { method: 'POST' });
    },
    async getSupplierSyncStatus(id: number) {
      return request<SupplierSyncStatus>(`/supplier-integrations/${id}/status/`);
    },

    // Supplier Products
    async getSupplierProducts(params?: string) {
      return request<PaginatedResponse<SupplierProduct>>(`/supplier-products/${params ? '?' + params : ''}`);
    },
    async getSupplierProduct(id: number) {
      return request<SupplierProduct>(`/supplier-products/${id}/`);
    },
    async linkSupplierProduct(id: number, productId: number) {
      return request<SupplierProduct>(`/supplier-products/${id}/link/`, { method: 'POST', body: JSON.stringify({ product_id: productId }) });
    },

    // Supplier Categories
    async getSupplierCategories(params?: string) {
      return request<PaginatedResponse<SupplierCategory>>(`/supplier-categories/${params ? '?' + params : ''}`);
    },
    async updateSupplierCategoryMapping(id: number, ourCategoryId: number | null) {
      return request<SupplierCategory>(`/supplier-categories/${id}/`, { method: 'PATCH', body: JSON.stringify({ our_category: ourCategoryId }) });
    },

    // Supplier Brands
    async getSupplierBrands(params?: string) {
      return request<PaginatedResponse<SupplierBrand>>(`/supplier-brands/${params ? '?' + params : ''}`);
    },

    // Supplier Sync Logs
    async getSupplierSyncLogs(params?: string) {
      return request<PaginatedResponse<SupplierSyncLog>>(`/supplier-sync-logs/${params ? '?' + params : ''}`);
    },

    // Portal Admin
    async getPortalRequests(params?: string) {
      return request<PortalRequest[]>(`/portal/requests/${params ? '?' + params : ''}`);
    },
    async getPortalRequestDetail(id: number) {
      return request<PortalRequest>(`/portal/requests/${id}/`);
    },
    async approvePortalRequest(id: number) {
      return request<PortalRequest>(`/portal/requests/${id}/approve/`, { method: 'POST' });
    },
    async rejectPortalRequest(id: number, reason?: string) {
      return request<PortalRequest>(`/portal/requests/${id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || '' }),
      });
    },
    async getPortalConfig() {
      return request<PortalConfig>(`/portal/config/`);
    },
    async updatePortalConfig(data: Record<string, unknown>) {
      return request<PortalConfig>(`/portal/config/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async getPortalPricing() {
      return request<PortalPricing[]>(`/portal/pricing/`);
    },
    async createPortalPricing(data: Record<string, unknown>) {
      return request<PortalPricing>(`/portal/pricing/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async updatePortalPricing(id: number, data: Record<string, unknown>) {
      return request<PortalPricing>(`/portal/pricing/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async deletePortalPricing(id: number) {
      return request<void>(`/portal/pricing/${id}/`, { method: 'DELETE' });
    },
    async getPortalCallbacks(params?: string) {
      return request<PortalCallback[]>(`/portal/callbacks/${params ? '?' + params : ''}`);
    },
    async updateCallbackStatus(id: number, status: string) {
      return request<PortalCallback>(`/portal/callbacks/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    async getPortalStats() {
      return request<PortalStats>(`/portal/stats/`);
    },
  };
}

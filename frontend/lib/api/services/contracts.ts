import type { RequestFn } from './types';
import type {
  AccumulativeEstimateRow, Act, CashFlowPeriodsResponse, CashFlowResponse,
  ContractAmendment, ContractDetail,
  ContractEstimateItem, ContractEstimateListItem, ContractEstimateSection,
  ContractListItem, ContractText, Correspondence, CreateActData,
  CreateContractAmendmentData, CreateCorrespondenceData, CreateFrameworkContractData,
  CreateWorkScheduleItemData, EstimateDeviationRow, EstimateRemainderRow,
  FrameworkContractDetail, FrameworkContractListItem, FrameworkContractStatus,
  InvoiceComplianceResult, PaginatedResponse, UpdateFrameworkContractData,
  WorkScheduleItem,
} from '../types';

const API_BASE_URL = '/api/erp';

export function createContractsService(request: RequestFn) {
  return {
    // Framework Contracts
    async getFrameworkContracts(params?: {
      counterparty?: number;
      legal_entity?: number;
      status?: FrameworkContractStatus;
      search?: string;
    }) {
      const queryParams = new URLSearchParams();
      if (params?.counterparty) queryParams.append('counterparty', params.counterparty.toString());
      if (params?.legal_entity) queryParams.append('legal_entity', params.legal_entity.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);

      const queryString = queryParams.toString();
      const endpoint = queryString ? `/framework-contracts/?${queryString}` : '/framework-contracts/';

      const response = await request<PaginatedResponse<FrameworkContractListItem> | FrameworkContractListItem[]>(endpoint);
      if (response && typeof response === 'object' && 'results' in response) {
        return response;
      }
      return { results: response as FrameworkContractListItem[], count: (response as FrameworkContractListItem[]).length };
    },

    async getFrameworkContract(id: number) {
      return request<FrameworkContractDetail>(`/framework-contracts/${id}/`);
    },

    async createFrameworkContract(data: CreateFrameworkContractData) {
      if (data.file) {
        const formData = new FormData();
        if (data.number) formData.append('number', data.number);
        formData.append('name', data.name);
        formData.append('date', data.date);
        formData.append('valid_from', data.valid_from);
        formData.append('valid_until', data.valid_until);
        formData.append('legal_entity', data.legal_entity.toString());
        formData.append('counterparty', data.counterparty.toString());
        if (data.status) formData.append('status', data.status);
        if (data.notes) formData.append('notes', data.notes);
        if (data.price_lists) {
          data.price_lists.forEach(id => formData.append('price_lists', id.toString()));
        }
        formData.append('file', data.file);

        return request<FrameworkContractDetail>('/framework-contracts/', {
          method: 'POST',
          body: formData,
        });
      }

      return request<FrameworkContractDetail>('/framework-contracts/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateFrameworkContract(id: number, data: UpdateFrameworkContractData) {
      if (data.file) {
        const formData = new FormData();
        if (data.number !== undefined) formData.append('number', data.number);
        if (data.name) formData.append('name', data.name);
        if (data.date) formData.append('date', data.date);
        if (data.valid_from) formData.append('valid_from', data.valid_from);
        if (data.valid_until) formData.append('valid_until', data.valid_until);
        if (data.legal_entity) formData.append('legal_entity', data.legal_entity.toString());
        if (data.counterparty) formData.append('counterparty', data.counterparty.toString());
        if (data.status) formData.append('status', data.status);
        if (data.notes !== undefined) formData.append('notes', data.notes);
        if (data.price_lists) {
          data.price_lists.forEach(id => formData.append('price_lists', id.toString()));
        }
        formData.append('file', data.file);

        return request<FrameworkContractDetail>(`/framework-contracts/${id}/`, {
          method: 'PATCH',
          body: formData,
        });
      }

      return request<FrameworkContractDetail>(`/framework-contracts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteFrameworkContract(id: number) {
      return request<void>(`/framework-contracts/${id}/`, { method: 'DELETE' });
    },

    async getFrameworkContractContracts(id: number) {
      return request<ContractListItem[]>(`/framework-contracts/${id}/contracts/`);
    },

    async addPriceListsToFrameworkContract(id: number, priceListIds: number[]) {
      return request<{ status: string }>(`/framework-contracts/${id}/add_price_lists/`, {
        method: 'POST',
        body: JSON.stringify({ price_list_ids: priceListIds }),
      });
    },

    async removePriceListsFromFrameworkContract(id: number, priceListIds: number[]) {
      return request<{ status: string }>(`/framework-contracts/${id}/remove_price_lists/`, {
        method: 'POST',
        body: JSON.stringify({ price_list_ids: priceListIds }),
      });
    },

    async activateFrameworkContract(id: number) {
      return request<{ status: string }>(`/framework-contracts/${id}/activate/`, { method: 'POST' });
    },

    async terminateFrameworkContract(id: number) {
      return request<{ status: string }>(`/framework-contracts/${id}/terminate/`, { method: 'POST' });
    },

    // Contracts
    async getContracts(params?: {
      object?: number;
      status?: string;
      contract_type?: string;
      currency?: string;
      counterparty?: number;
      legal_entity?: number;
      search?: string;
      ordering?: string;
      page_size?: number;
      page?: number;
    }) {
      const queryParams = new URLSearchParams();
      if (params?.object) queryParams.append('object', params.object.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.contract_type) queryParams.append('contract_type', params.contract_type);
      if (params?.currency) queryParams.append('currency', params.currency);
      if (params?.counterparty) queryParams.append('counterparty', params.counterparty.toString());
      if (params?.legal_entity) queryParams.append('legal_entity', params.legal_entity.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.ordering) queryParams.append('ordering', params.ordering);
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      const queryString = queryParams.toString();
      const endpoint = `/contracts/${queryString ? `?${queryString}` : ''}`;
      const response = await request<PaginatedResponse<ContractListItem> | ContractListItem[]>(endpoint);
      if (response && typeof response === 'object' && 'results' in response) {
        return response;
      }
      return { results: response as ContractListItem[], count: (response as ContractListItem[]).length };
    },

    async getContractDetail(id: number) {
      return request<ContractDetail>(`/contracts/${id}/`);
    },

    async getContractBalance(id: number) {
      return request<{ balance: string }>(`/contracts/${id}/balance/`);
    },

    async getContract(id: number) {
      return this.getContractDetail(id);
    },

    async getContractSchedule(contractId: number) {
      return request<WorkScheduleItem[]>(`/contracts/${contractId}/schedule/`);
    },

    async getContractMargin(id: number) {
      return request<{ margin: string; margin_percent: string }>(`/contracts/${id}/margin/`);
    },

    async getContractCashFlow(id: number, params?: { start_date?: string; end_date?: string }) {
      const queryParams = new URLSearchParams();
      if (params?.start_date) queryParams.append('start_date', params.start_date);
      if (params?.end_date) queryParams.append('end_date', params.end_date);
      const queryString = queryParams.toString();
      return request<CashFlowResponse>(`/contracts/${id}/cash-flow/${queryString ? `?${queryString}` : ''}`);
    },

    async getContractCashFlowPeriods(id: number, params?: { period_type?: string; start_date?: string; end_date?: string }) {
      const queryParams = new URLSearchParams();
      if (params?.period_type) queryParams.append('period_type', params.period_type);
      if (params?.start_date) queryParams.append('start_date', params.start_date);
      if (params?.end_date) queryParams.append('end_date', params.end_date);
      const queryString = queryParams.toString();
      return request<CashFlowPeriodsResponse>(`/contracts/${id}/cash-flow-periods/${queryString ? `?${queryString}` : ''}`);
    },

    async getContractCorrespondence(contractId: number) {
      return request<Correspondence[]>(`/contracts/${contractId}/correspondence/`);
    },

    async createContract(data: Partial<ContractDetail> & { file?: File }) {
      if (data.file) {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
          const value = (data as Record<string, unknown>)[key];
          if (key !== 'file' && value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
        if (data.file) formData.append('file', data.file);

        return request<ContractDetail>('/contracts/', {
          method: 'POST',
          body: formData,
        });
      }

      return request<ContractDetail>('/contracts/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateContract(id: number, data: Partial<ContractDetail> & { file?: File }) {
      if (data.file) {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
          const value = (data as Record<string, unknown>)[key];
          if (key !== 'file' && value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
        if (data.file) formData.append('file', data.file);

        return request<ContractDetail>(`/contracts/${id}/`, {
          method: 'PATCH',
          body: formData,
        });
      }

      return request<ContractDetail>(`/contracts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteContract(id: number) {
      return request<void>(`/contracts/${id}/`, { method: 'DELETE' });
    },

    // Work Schedule
    async getWorkSchedule(contractId: number) {
      const response = await request<PaginatedResponse<WorkScheduleItem> | WorkScheduleItem[]>(`/work-schedule/?contract=${contractId}`);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as WorkScheduleItem[];
    },

    async createWorkScheduleItem(data: CreateWorkScheduleItemData) {
      return request<WorkScheduleItem>('/work-schedule/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateWorkScheduleItem(id: number, data: Partial<CreateWorkScheduleItemData>) {
      return request<WorkScheduleItem>(`/work-schedule/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteWorkScheduleItem(id: number) {
      return request<void>(`/work-schedule/${id}/`, { method: 'DELETE' });
    },

    // Acts
    async getActs(params: number | { contract?: number; status?: string; act_type?: string; search?: string }) {
      const queryStr = typeof params === 'number'
        ? `contract=${params}`
        : Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&');
      const response = await request<PaginatedResponse<Act> | Act[]>(`/acts/?${queryStr}`);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as Act[];
    },

    async createAct(data: CreateActData) {
      return request<Act>('/acts/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async signAct(id: number) {
      return request<Act>(`/acts/${id}/sign/`, { method: 'POST' });
    },

    async getActDetail(id: number) {
      return request<Act>(`/acts/${id}/`);
    },

    async updateAct(id: number, data: Partial<CreateActData>) {
      return request<Act>(`/acts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteAct(id: number) {
      return request<void>(`/acts/${id}/`, { method: 'DELETE' });
    },

    async agreeAct(id: number) {
      return request<{ status: string }>(`/acts/${id}/agree/`, { method: 'POST' });
    },

    async createActFromAccumulative(data: {
      contract_estimate_id: number;
      number: string;
      date: string;
      period_start?: string;
      period_end?: string;
      items: Array<{
        contract_estimate_item_id: number;
        quantity?: string;
        unit_price?: string;
      }>;
    }) {
      return request<Act>('/acts/from-accumulative/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Contract Estimates
    async getContractEstimates(contractId?: number) {
      const params = contractId ? `?contract=${contractId}` : '';
      const response = await request<PaginatedResponse<ContractEstimateListItem>>(`/contract-estimates/${params}`);
      return response.results;
    },

    async getContractEstimateDetail(id: number) {
      return request<ContractEstimateListItem>(`/contract-estimates/${id}/`);
    },

    async createContractEstimateFromEstimate(estimateId: number, contractId: number) {
      return request<ContractEstimateListItem>('/contract-estimates/from-estimate/', {
        method: 'POST',
        body: JSON.stringify({ estimate_id: estimateId, contract_id: contractId }),
      });
    },

    async getContractEstimateItems(contractEstimateId: number) {
      const response = await request<PaginatedResponse<ContractEstimateItem>>(
        `/contract-estimate-items/?contract_estimate=${contractEstimateId}`
      );
      return response.results;
    },

    async getContractEstimateSections(contractEstimateId: number) {
      const response = await request<PaginatedResponse<ContractEstimateSection>>(
        `/contract-estimate-sections/?contract_estimate=${contractEstimateId}`
      );
      return response.results;
    },

    // ContractEstimateItem CRUD
    async createContractEstimateItem(data: Partial<ContractEstimateItem>) {
      return request<ContractEstimateItem>('/contract-estimate-items/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateContractEstimateItem(id: number, data: Partial<ContractEstimateItem>) {
      return request<ContractEstimateItem>(`/contract-estimate-items/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteContractEstimateItem(id: number) {
      return request<void>(`/contract-estimate-items/${id}/`, { method: 'DELETE' });
    },

    // ContractEstimateSection CRUD
    async createContractEstimateSection(data: { contract_estimate: number; name: string; sort_order?: number }) {
      return request<ContractEstimateSection>('/contract-estimate-sections/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateContractEstimateSection(id: number, data: Partial<{ name: string; sort_order: number }>) {
      return request<ContractEstimateSection>(`/contract-estimate-sections/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteContractEstimateSection(id: number) {
      return request<void>(`/contract-estimate-sections/${id}/`, { method: 'DELETE' });
    },

    // ContractEstimate actions
    async createContractEstimateVersion(id: number, amendmentId?: number) {
      return request<ContractEstimateListItem>(`/contract-estimates/${id}/create-version/`, {
        method: 'POST',
        body: JSON.stringify(amendmentId ? { amendment_id: amendmentId } : {}),
      });
    },

    async splitContractEstimate(id: number, sectionsMapping: Array<{ section_ids: number[]; contract_id: number }>) {
      return request<ContractEstimateListItem[]>(`/contract-estimates/${id}/split/`, {
        method: 'POST',
        body: JSON.stringify({ sections_mapping: sectionsMapping }),
      });
    },

    async updateContractEstimate(id: number, data: Partial<ContractEstimateListItem>) {
      return request<ContractEstimateListItem>(`/contract-estimates/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Contract Text
    async getContractTexts(contractId: number) {
      const response = await request<PaginatedResponse<ContractText>>(
        `/contract-texts/?contract=${contractId}`
      );
      return response.results;
    },

    async createContractText(data: { contract: number; content_md: string; amendment?: number }) {
      return request<ContractText>('/contract-texts/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateContractText(id: number, data: { content_md: string }) {
      return request<ContractText>(`/contract-texts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteContractText(id: number) {
      return request<void>(`/contract-texts/${id}/`, { method: 'DELETE' });
    },

    // Accumulative Estimate
    async getAccumulativeEstimate(contractId: number) {
      return request<AccumulativeEstimateRow[]>(
        `/contracts/${contractId}/accumulative-estimate/`
      );
    },

    async getEstimateRemainder(contractId: number) {
      return request<EstimateRemainderRow[]>(
        `/contracts/${contractId}/estimate-remainder/`
      );
    },

    async exportAccumulativeEstimate(contractId: number) {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/contracts/${contractId}/accumulative-estimate/export/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return response.blob();
    },

    async getEstimateDeviations(contractId: number) {
      return request<EstimateDeviationRow[]>(
        `/contracts/${contractId}/estimate-deviations/`
      );
    },

    // Invoice compliance check
    async checkInvoiceCompliance(invoiceId: number) {
      return request<InvoiceComplianceResult>(
        `/contracts/check-invoice/${invoiceId}/`
      );
    },

    async autoLinkInvoice(invoiceId: number) {
      return request<InvoiceComplianceResult>(
        `/contracts/auto-link-invoice/${invoiceId}/`,
        { method: 'POST' },
      );
    },

    // Contract Amendments
    async getContractAmendments(contractId: number) {
      const response = await request<PaginatedResponse<ContractAmendment> | ContractAmendment[]>(`/contract-amendments/?contract=${contractId}`);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as ContractAmendment[];
    },

    async createContractAmendment(data: CreateContractAmendmentData) {
      if (data.file) {
        const formData = new FormData();
        formData.append('contract', data.contract.toString());
        formData.append('number', data.number);
        formData.append('date', data.date);
        formData.append('reason', data.reason);
        if (data.new_start_date) formData.append('new_start_date', data.new_start_date);
        if (data.new_end_date) formData.append('new_end_date', data.new_end_date);
        if (data.new_total_amount) formData.append('new_total_amount', data.new_total_amount);
        formData.append('file', data.file);

        return request<ContractAmendment>('/contract-amendments/', {
          method: 'POST',
          body: formData,
        });
      }

      return request<ContractAmendment>('/contract-amendments/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateContractAmendment(id: number, data: Partial<CreateContractAmendmentData>) {
      if (data.file) {
        const formData = new FormData();
        if (data.contract) formData.append('contract', data.contract.toString());
        if (data.number) formData.append('number', data.number);
        if (data.date) formData.append('date', data.date);
        if (data.reason) formData.append('reason', data.reason);
        if (data.new_start_date) formData.append('new_start_date', data.new_start_date);
        if (data.new_end_date) formData.append('new_end_date', data.new_end_date);
        if (data.new_total_amount) formData.append('new_total_amount', data.new_total_amount);
        formData.append('file', data.file);

        return request<ContractAmendment>(`/contract-amendments/${id}/`, {
          method: 'PATCH',
          body: formData,
        });
      }

      return request<ContractAmendment>(`/contract-amendments/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteContractAmendment(id: number) {
      return request<void>(`/contract-amendments/${id}/`, { method: 'DELETE' });
    },

    // Correspondence
    async getCorrespondence(params?: {
      contract?: number;
      type?: 'incoming' | 'outgoing';
      category?: string;
      status?: string;
      search?: string;
    }) {
      const queryParams = new URLSearchParams();
      if (params?.contract) queryParams.append('contract', params.contract.toString());
      if (params?.type) queryParams.append('type', params.type);
      if (params?.category) queryParams.append('category', params.category);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);

      const queryString = queryParams.toString();
      const endpoint = `/correspondence/${queryString ? `?${queryString}` : ''}`;

      const response = await request<PaginatedResponse<Correspondence> | Correspondence[]>(endpoint);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as Correspondence[];
    },

    async createCorrespondence(data: CreateCorrespondenceData) {
      const formData = new FormData();
      formData.append('contract', data.contract.toString());
      formData.append('type', data.type);
      formData.append('category', data.category);
      formData.append('number', data.number);
      formData.append('date', data.date);
      formData.append('subject', data.subject);
      if (data.status) formData.append('status', data.status);
      if (data.description) formData.append('description', data.description);
      if (data.file) formData.append('file', data.file);
      if (data.related_to) formData.append('related_to', data.related_to.toString());

      return request<Correspondence>('/correspondence/', {
        method: 'POST',
        body: formData,
      });
    },

    async updateCorrespondence(id: number, data: Partial<CreateCorrespondenceData>) {
      const formData = new FormData();
      if (data.contract) formData.append('contract', data.contract.toString());
      if (data.type) formData.append('type', data.type);
      if (data.category) formData.append('category', data.category);
      if (data.number) formData.append('number', data.number);
      if (data.date) formData.append('date', data.date);
      if (data.subject) formData.append('subject', data.subject);
      if (data.status) formData.append('status', data.status);
      if (data.description) formData.append('description', data.description);
      if (data.file) formData.append('file', data.file);
      if (data.related_to) formData.append('related_to', data.related_to.toString());

      return request<Correspondence>(`/correspondence/${id}/`, {
        method: 'PATCH',
        body: formData,
      });
    },

    async deleteCorrespondence(id: number) {
      return request<void>(`/correspondence/${id}/`, { method: 'DELETE' });
    },
  };
}

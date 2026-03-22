import type { RequestFn } from './types';
import type {
  CreateFrontOfWorkItemData, CreateMountingConditionData, FrontOfWorkItem,
  MountingCondition, MountingProposalDetail, MountingProposalListItem,
  PaginatedResponse, TKPCharacteristic, TKPEstimateSection,
  TKPEstimateSubsection, TKPFrontOfWork, TechnicalProposalDetail,
  TechnicalProposalListItem,
} from '../types';

export function createProposalsService(request: RequestFn) {
  return {
    // Front of Work Items
    async getFrontOfWorkItems(filters?: { category?: string; is_active?: boolean; is_default?: boolean; search?: string }) {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters?.is_default !== undefined) params.append('is_default', filters.is_default.toString());
      if (filters?.search) params.append('search', filters.search);

      const url = `/front-of-work-items/${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await request<PaginatedResponse<FrontOfWorkItem> | FrontOfWorkItem[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as FrontOfWorkItem[];
    },

    async createFrontOfWorkItem(data: CreateFrontOfWorkItemData) {
      return request<FrontOfWorkItem>('/front-of-work-items/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateFrontOfWorkItem(id: number, data: Partial<CreateFrontOfWorkItemData>) {
      return request<FrontOfWorkItem>(`/front-of-work-items/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteFrontOfWorkItem(id: number) {
      return request<void>(`/front-of-work-items/${id}/`, { method: 'DELETE' });
    },

    // Mounting Conditions
    async getMountingConditions(filters?: { is_active?: boolean; is_default?: boolean; search?: string }) {
      const params = new URLSearchParams();
      if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
      if (filters?.is_default !== undefined) params.append('is_default', filters.is_default.toString());
      if (filters?.search) params.append('search', filters.search);

      const url = `/mounting-conditions/${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await request<PaginatedResponse<MountingCondition> | MountingCondition[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as MountingCondition[];
    },

    async createMountingCondition(data: CreateMountingConditionData) {
      return request<MountingCondition>('/mounting-conditions/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateMountingCondition(id: number, data: Partial<CreateMountingConditionData>) {
      return request<MountingCondition>(`/mounting-conditions/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteMountingCondition(id: number) {
      return request<void>(`/mounting-conditions/${id}/`, { method: 'DELETE' });
    },

    // ==================== TKP ====================

    async getTechnicalProposals(filters?: {
      object?: number;
      legal_entity?: number;
      status?: string;
      search?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.object) params.append('object', filters.object.toString());
      if (filters?.legal_entity) params.append('legal_entity', filters.legal_entity.toString());
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);

      const url = `/technical-proposals/${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await request<PaginatedResponse<TechnicalProposalListItem> | TechnicalProposalListItem[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response;
      }
      return { results: response as TechnicalProposalListItem[], count: (response as TechnicalProposalListItem[]).length };
    },

    async getTechnicalProposal(id: number) {
      return request<TechnicalProposalDetail>(`/technical-proposals/${id}/`);
    },

    async createTechnicalProposal(data: FormData) {
      return request<TechnicalProposalDetail>('/technical-proposals/', {
        method: 'POST',
        body: data,
      });
    },

    async updateTechnicalProposal(id: number, data: FormData) {
      return request<TechnicalProposalDetail>(`/technical-proposals/${id}/`, {
        method: 'PATCH',
        body: data,
      });
    },

    async deleteTechnicalProposal(id: number) {
      return request<void>(`/technical-proposals/${id}/`, { method: 'DELETE' });
    },

    async createTechnicalProposalVersion(id: number, data?: { date?: string }) {
      return request<TechnicalProposalDetail>(`/technical-proposals/${id}/create-version/`, {
        method: 'POST',
        body: data ? JSON.stringify(data) : JSON.stringify({}),
      });
    },

    async getTechnicalProposalVersions(id: number) {
      return request<TechnicalProposalListItem[]>(`/technical-proposals/${id}/versions/`);
    },

    async addEstimatesToTKP(id: number, estimateIds: number[], copyData: boolean = true) {
      return request<{ message: string; estimates_count: number }>(`/technical-proposals/${id}/add-estimates/`, {
        method: 'POST',
        body: JSON.stringify({ estimate_ids: estimateIds, copy_data: copyData }),
      });
    },

    async removeEstimatesFromTKP(id: number, estimateIds: number[]) {
      return request<{ message: string }>(`/technical-proposals/${id}/remove-estimates/`, {
        method: 'POST',
        body: JSON.stringify({ estimate_ids: estimateIds }),
      });
    },

    async copyDataFromEstimates(id: number) {
      return request<{ message: string }>(`/technical-proposals/${id}/copy-from-estimates/`, { method: 'POST' });
    },

    // TKP Sections
    async getTKPSections(tkpId: number) {
      const response = await request<PaginatedResponse<TKPEstimateSection> | TKPEstimateSection[]>(`/tkp-sections/?tkp=${tkpId}`);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as TKPEstimateSection[];
    },

    async updateTKPSection(id: number, data: Partial<TKPEstimateSection>) {
      return request<TKPEstimateSection>(`/tkp-sections/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async updateTKPSubsection(id: number, data: Partial<TKPEstimateSubsection>) {
      return request<TKPEstimateSubsection>(`/tkp-subsections/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // TKP Front of Work
    async getTKPFrontOfWork(tkpId: number) {
      const response = await request<PaginatedResponse<TKPFrontOfWork> | TKPFrontOfWork[]>(`/tkp-front-of-work/?tkp=${tkpId}`);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as TKPFrontOfWork[];
    },

    async createTKPFrontOfWork(data: {
      tkp: number;
      front_item: number;
      when_text?: string;
      when_date?: string;
      sort_order?: number;
    }) {
      return request<TKPFrontOfWork>('/tkp-front-of-work/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateTKPFrontOfWork(id: number, data: Partial<{
      when_text: string;
      when_date: string;
      sort_order: number;
    }>) {
      return request<TKPFrontOfWork>(`/tkp-front-of-work/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteTKPFrontOfWork(id: number) {
      return request<void>(`/tkp-front-of-work/${id}/`, { method: 'DELETE' });
    },

    // TKP Characteristics
    async getTKPCharacteristics(tkpId: number) {
      const response = await request<PaginatedResponse<TKPCharacteristic> | TKPCharacteristic[]>(`/tkp-characteristics/?tkp=${tkpId}`);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as TKPCharacteristic[];
    },

    async createTKPCharacteristic(data: {
      tkp: number;
      name: string;
      purchase_amount: string;
      sale_amount: string;
      sort_order?: number;
    }) {
      return request<TKPCharacteristic>('/tkp-characteristics/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateTKPCharacteristic(id: number, data: Partial<{
      name: string;
      purchase_amount: string;
      sale_amount: string;
      sort_order: number;
    }>) {
      return request<TKPCharacteristic>(`/tkp-characteristics/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteTKPCharacteristic(id: number) {
      return request<void>(`/tkp-characteristics/${id}/`, { method: 'DELETE' });
    },

    // ==================== MOUNTING PROPOSALS ====================

    async getMountingProposals(filters?: {
      object?: string;
      counterparty?: string;
      status?: string;
      search?: string;
      parent_tkp?: string;
    }) {
      const params = new URLSearchParams();
      if (filters?.object) params.append('object', filters.object);
      if (filters?.counterparty) params.append('counterparty', filters.counterparty);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.parent_tkp) params.append('parent_tkp', filters.parent_tkp);

      const url = `/mounting-proposals/${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await request<PaginatedResponse<MountingProposalListItem> | MountingProposalListItem[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response;
      }
      return { results: response as MountingProposalListItem[], count: (response as MountingProposalListItem[]).length };
    },

    async getMountingProposal(id: number) {
      return request<MountingProposalDetail>(`/mounting-proposals/${id}/`);
    },

    async createMountingProposalStandalone(data: FormData) {
      return request<MountingProposalDetail>('/mounting-proposals/', {
        method: 'POST',
        body: data,
      });
    },

    async updateMountingProposal(id: number, data: FormData) {
      return request<MountingProposalDetail>(`/mounting-proposals/${id}/`, {
        method: 'PATCH',
        body: data,
      });
    },

    async deleteMountingProposal(id: number) {
      return request<void>(`/mounting-proposals/${id}/`, { method: 'DELETE' });
    },

    async createMountingProposalVersion(id: number, data?: { date?: string }) {
      return request<MountingProposalDetail>(`/mounting-proposals/${id}/create-version/`, {
        method: 'POST',
        body: data ? JSON.stringify(data) : JSON.stringify({}),
      });
    },

    async getMountingProposalVersions(id: number) {
      return request<MountingProposalListItem[]>(`/mounting-proposals/${id}/versions/`);
    },

    async publishMountingProposalToTelegram(id: number) {
      return request<{ message: string; published_at: string }>(`/mounting-proposals/${id}/mark-telegram-published/`, { method: 'POST' });
    },

    async createMountingProposalFromTKP(tkpId: number, data: { counterparty: number; notes?: string }) {
      return request<MountingProposalDetail>(`/technical-proposals/${tkpId}/create-mp/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };
}

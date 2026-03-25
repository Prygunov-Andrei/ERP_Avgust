import type { RequestFn } from './types';
import type {
  CreatePriceListAgreementData, CreatePriceListData, CreatePriceListItemData,
  CreateWorkItemData, CreateWorkSectionData, CreateWorkerGradeData,
  CreateWorkerGradeSkillsData, PaginatedResponse, PriceListAgreement,
  PriceListDetail, PriceListItem, PriceListList, UpdatePriceListItemData,
  WorkItemDetail, WorkItemList, WorkSection, WorkerGrade, WorkerGradeSkills,
} from '../types';

const API_BASE_URL = '/api/erp';

export function createPricelistsService(request: RequestFn) {
  return {
    // Worker Grades
    async getWorkerGrades(isActive?: boolean) {
      let url = '/worker-grades/';
      if (isActive !== undefined) {
        url += `?is_active=${isActive}`;
      }
      const response = await request<PaginatedResponse<WorkerGrade> | WorkerGrade[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as WorkerGrade[];
    },

    async createWorkerGrade(data: CreateWorkerGradeData) {
      return request<WorkerGrade>('/worker-grades/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateWorkerGrade(id: number, data: Partial<CreateWorkerGradeData>) {
      return request<WorkerGrade>(`/worker-grades/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Work Sections
    async getWorkSections(tree?: boolean, search?: string) {
      let url = '/work-sections/';
      const params: string[] = [];
      if (tree) params.push('tree=true');
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await request<PaginatedResponse<WorkSection> | WorkSection[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as WorkSection[];
    },

    async createWorkSection(data: CreateWorkSectionData) {
      return request<WorkSection>('/work-sections/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateWorkSection(id: number, data: Partial<CreateWorkSectionData>) {
      return request<WorkSection>(`/work-sections/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    // Worker Grade Skills
    async getWorkerGradeSkills(gradeId?: number, sectionId?: number) {
      let url = '/worker-grade-skills/';
      const params: string[] = [];
      if (gradeId) params.push(`grade=${gradeId}`);
      if (sectionId) params.push(`section=${sectionId}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await request<PaginatedResponse<WorkerGradeSkills> | WorkerGradeSkills[]>(url);
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as WorkerGradeSkills[];
    },

    async createWorkerGradeSkills(data: CreateWorkerGradeSkillsData) {
      return request<WorkerGradeSkills>('/worker-grade-skills/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateWorkerGradeSkills(id: number, data: Partial<CreateWorkerGradeSkillsData>) {
      return request<WorkerGradeSkills>(`/worker-grade-skills/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteWorkerGradeSkills(id: number) {
      return request<void>(`/worker-grade-skills/${id}/`, { method: 'DELETE' });
    },

    // Work Items
    async getWorkItems() {
      return request<WorkItemList[]>('/work-items/');
    },

    async getWorkItemDetail(id: number) {
      return request<WorkItemDetail>(`/work-items/${id}/`);
    },

    async createWorkItem(data: CreateWorkItemData) {
      return request<WorkItemDetail>('/work-items/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateWorkItem(id: number, data: Partial<CreateWorkItemData>) {
      return request<WorkItemDetail>(`/work-items/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deleteWorkItem(id: number) {
      return request<void>(`/work-items/${id}/`, { method: 'DELETE' });
    },

    async getWorkItemVersions(id: number) {
      return request<WorkItemDetail[]>(`/work-items/${id}/versions/`);
    },

    // Price Lists
    async getPriceLists() {
      const response = await request<PaginatedResponse<PriceListList> | PriceListList[]>('/price-lists/');
      if (response && typeof response === 'object' && 'results' in response) {
        return response.results;
      }
      return response as PriceListList[];
    },

    async getPriceListDetail(id: number) {
      return request<PriceListDetail>(`/price-lists/${id}/`);
    },

    async createPriceList(data: CreatePriceListData) {
      return request<PriceListDetail>('/price-lists/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updatePriceList(id: number, data: Partial<CreatePriceListData>) {
      return request<PriceListDetail>(`/price-lists/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async addPriceListItems(id: number, workItems: number[]) {
      return request<PriceListDetail>(`/price-lists/${id}/add-items/`, {
        method: 'POST',
        body: JSON.stringify({ work_items: workItems }),
      });
    },

    async removePriceListItems(id: number, workItems: number[]) {
      return request<PriceListDetail>(`/price-lists/${id}/remove-items/`, {
        method: 'POST',
        body: JSON.stringify({ work_items: workItems }),
      });
    },

    async createPriceListItem(data: CreatePriceListItemData) {
      return request<PriceListItem>('/price-list-items/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updatePriceListItem(id: number, data: UpdatePriceListItemData) {
      return request<PriceListItem>(`/price-list-items/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async deletePriceListItem(id: number) {
      return request<void>(`/price-list-items/${id}/`, { method: 'DELETE' });
    },

    async createPriceListAgreement(data: CreatePriceListAgreementData) {
      return request<PriceListAgreement>('/price-list-agreements/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async deletePriceListAgreement(id: number) {
      return request<void>(`/price-list-agreements/${id}/`, { method: 'DELETE' });
    },

    async createPriceListVersion(id: number) {
      return request<PriceListDetail>(`/price-lists/${id}/create-version/`, { method: 'POST' });
    },

    async exportPriceList(id: number): Promise<Blob> {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/price-lists/${id}/export/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка при экспорте прайс-листа');
      }

      return response.blob();
    },
  };
}

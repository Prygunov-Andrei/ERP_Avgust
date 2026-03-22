import type { RequestFn } from './types';
import type {
  ConstructionObject, InviteToken, PaginatedResponse, WorkJournalSummary,
  WorklogAnswer, WorklogMedia, WorklogQuestion, WorklogReport,
  WorklogReportDetail, WorklogShift, WorklogSupergroup, WorklogTeam,
} from '../types';

export function createWorklogService(request: RequestFn) {
  return {
    async getWorkJournalSummary(objectId: number): Promise<WorkJournalSummary> {
      return request<WorkJournalSummary>(`/objects/${objectId}/work-journal/`);
    },

    async getWorklogShifts(params?: {
      object?: number;
      contractor?: number;
      status?: string;
      date?: string;
      shift_type?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedResponse<WorklogShift>> {
      const queryParams = new URLSearchParams();
      if (params?.object) queryParams.append('object', params.object.toString());
      if (params?.contractor) queryParams.append('contractor', params.contractor.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.date) queryParams.append('date', params.date);
      if (params?.shift_type) queryParams.append('shift_type', params.shift_type);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      const qs = queryParams.toString();
      return request<PaginatedResponse<WorklogShift>>(`/worklog/shifts/${qs ? `?${qs}` : ''}`);
    },

    async getWorklogTeams(params?: {
      object?: number;
      shift?: string;
      status?: string;
      contractor?: number;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedResponse<WorklogTeam>> {
      const queryParams = new URLSearchParams();
      if (params?.object) queryParams.append('object', params.object.toString());
      if (params?.shift) queryParams.append('shift', params.shift);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.contractor) queryParams.append('contractor', params.contractor.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      const qs = queryParams.toString();
      return request<PaginatedResponse<WorklogTeam>>(`/worklog/teams/${qs ? `?${qs}` : ''}`);
    },

    async getWorklogMedia(params?: {
      team?: string;
      media_type?: string;
      tag?: string;
      status?: string;
      search?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedResponse<WorklogMedia>> {
      const queryParams = new URLSearchParams();
      if (params?.team) queryParams.append('team', params.team);
      if (params?.media_type) queryParams.append('media_type', params.media_type);
      if (params?.tag) queryParams.append('tag', params.tag);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      const qs = queryParams.toString();
      return request<PaginatedResponse<WorklogMedia>>(`/worklog/media/${qs ? `?${qs}` : ''}`);
    },

    async getWorklogReports(params?: {
      team?: string;
      shift?: string;
      report_type?: string;
      status?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedResponse<WorklogReport>> {
      const queryParams = new URLSearchParams();
      if (params?.team) queryParams.append('team', params.team);
      if (params?.shift) queryParams.append('shift', params.shift);
      if (params?.report_type) queryParams.append('report_type', params.report_type);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      const qs = queryParams.toString();
      return request<PaginatedResponse<WorklogReport>>(`/worklog/reports/${qs ? `?${qs}` : ''}`);
    },

    async getWorklogReportDetail(reportId: string): Promise<WorklogReportDetail> {
      return request<WorklogReportDetail>(`/worklog/reports/${reportId}/`);
    },

    async getWorklogQuestions(params?: {
      report?: string;
      status?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedResponse<WorklogQuestion>> {
      const queryParams = new URLSearchParams();
      if (params?.report) queryParams.append('report', params.report);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      const qs = queryParams.toString();
      return request<PaginatedResponse<WorklogQuestion>>(`/worklog/questions/${qs ? `?${qs}` : ''}`);
    },

    async createWorklogShift(data: {
      contract: number;
      date: string;
      shift_type: string;
      start_time: string;
      end_time: string;
    }): Promise<WorklogShift> {
      return request<WorklogShift>('/worklog/shifts/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async activateWorklogShift(shiftId: string): Promise<WorklogShift> {
      return request<WorklogShift>(`/worklog/shifts/${shiftId}/activate/`, { method: 'POST' });
    },

    async closeWorklogShift(shiftId: string): Promise<WorklogShift> {
      return request<WorklogShift>(`/worklog/shifts/${shiftId}/close/`, { method: 'POST' });
    },

    async createWorklogQuestion(data: { report_id: string; text: string }): Promise<WorklogQuestion> {
      return request<WorklogQuestion>('/worklog/questions/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async answerWorklogQuestion(questionId: string, data: { text: string }): Promise<WorklogAnswer> {
      return request<WorklogAnswer>(`/worklog/questions/${questionId}/answer/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getWorklogSupergroups(params?: {
      object?: number;
      contractor?: number;
      is_active?: boolean;
    }): Promise<PaginatedResponse<WorklogSupergroup>> {
      const queryParams = new URLSearchParams();
      if (params?.object) queryParams.append('object', params.object.toString());
      if (params?.contractor) queryParams.append('contractor', params.contractor.toString());
      if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
      const qs = queryParams.toString();
      return request<PaginatedResponse<WorklogSupergroup>>(`/worklog/supergroups/${qs ? `?${qs}` : ''}`);
    },

    // InviteToken (deep-link)
    async createInviteToken(data: {
      contractor: number;
      role?: string;
    }): Promise<InviteToken> {
      return request<InviteToken>('/worklog/invites/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getInviteTokens(params?: {
      contractor?: number;
      used?: boolean;
      role?: string;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedResponse<InviteToken>> {
      const queryParams = new URLSearchParams();
      if (params?.contractor) queryParams.append('contractor', params.contractor.toString());
      if (params?.used !== undefined) queryParams.append('used', params.used.toString());
      if (params?.role) queryParams.append('role', params.role);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      const qs = queryParams.toString();
      return request<PaginatedResponse<InviteToken>>(`/worklog/invites/${qs ? `?${qs}` : ''}`);
    },
  };
}

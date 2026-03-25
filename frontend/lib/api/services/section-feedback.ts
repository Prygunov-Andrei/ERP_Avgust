import type { RequestFn } from './types';
import type {
  FeedbackAttachment,
  FeedbackReply,
  FeedbackSection,
  FeedbackStats,
  FeedbackStatus,
  PaginatedResponse,
  SectionFeedback,
  SectionFeedbackListItem,
} from '../types';

export function createSectionFeedbackService(request: RequestFn) {
  return {
    async list(params?: {
      section?: FeedbackSection;
      status?: FeedbackStatus;
      page?: number;
      page_size?: number;
    }): Promise<PaginatedResponse<SectionFeedbackListItem>> {
      const qp = new URLSearchParams();
      if (params?.section) qp.append('section', params.section);
      if (params?.status) qp.append('status', params.status);
      if (params?.page) qp.append('page', params.page.toString());
      if (params?.page_size) qp.append('page_size', params.page_size.toString());
      const qs = qp.toString();
      return request<PaginatedResponse<SectionFeedbackListItem>>(
        `/section-feedback/${qs ? `?${qs}` : ''}`
      );
    },

    async get(id: number): Promise<SectionFeedback> {
      return request<SectionFeedback>(`/section-feedback/${id}/`);
    },

    async create(data: { section: FeedbackSection; text: string }): Promise<SectionFeedback> {
      return request<SectionFeedback>('/section-feedback/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateStatus(id: number, status: FeedbackStatus): Promise<SectionFeedback> {
      return request<SectionFeedback>(`/section-feedback/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    async delete(id: number): Promise<void> {
      return request<void>(`/section-feedback/${id}/`, { method: 'DELETE' });
    },

    async getReplies(feedbackId: number): Promise<FeedbackReply[]> {
      return request<FeedbackReply[]>(`/section-feedback/${feedbackId}/replies/`);
    },

    async createReply(feedbackId: number, text: string): Promise<FeedbackReply> {
      return request<FeedbackReply>(`/section-feedback/${feedbackId}/replies/`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    },

    async uploadAttachment(feedbackId: number, file: File): Promise<FeedbackAttachment> {
      const formData = new FormData();
      formData.append('file', file);
      return request<FeedbackAttachment>(
        `/section-feedback/${feedbackId}/upload_attachment/`,
        { method: 'POST', body: formData }
      );
    },

    async uploadReplyAttachment(replyId: number, file: File): Promise<FeedbackAttachment> {
      const formData = new FormData();
      formData.append('file', file);
      return request<FeedbackAttachment>(
        `/section-feedback/replies/${replyId}/upload_attachment/`,
        { method: 'POST', body: formData }
      );
    },

    async stats(): Promise<FeedbackStats[]> {
      return request<FeedbackStats[]>('/section-feedback/stats/');
    },
  };
}

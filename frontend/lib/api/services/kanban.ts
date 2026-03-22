import type { RequestFn } from './types';

/* ---------- Kanban Types ---------- */

export type KanbanBoard = { id: string; key: string; title: string };
export type KanbanColumn = { id: string; board: string; key: string; title: string; order: number };

export type KanbanCard = {
  id: string;
  board: string;
  column: string;
  type: string;
  title: string;
  description: string;
  meta: Record<string, unknown>;
  due_date: string | null;
  assignee_user_id: number | null;
  assignee_username: string;
  created_by_user_id: number | null;
  created_by_username: string;
  created_at: string;
  updated_at: string;
};

export type CardColor = 'red' | 'yellow' | 'blue' | 'green' | null;

export type CommercialCase = {
  id: string;
  card: string;
  erp_object_id: number | null;
  erp_object_name: string;
  system_name: string;
  erp_counterparty_id: number | null;
  erp_counterparty_name: string;
  erp_tkp_ids: number[];
  contacts_info: string;
  comments: string;
  created_at: string;
  updated_at: string;
};

export type KanbanAttachment = {
  id: string;
  card: string;
  file: string;
  file_sha256: string;
  file_mime_type: string;
  file_original_filename: string;
  kind: 'document' | 'photo' | 'other';
  document_type: string;
  title: string;
  meta: Record<string, unknown>;
  created_by_user_id: number | null;
  created_by_username: string;
  created_at: string;
};

export type FileInitResponse = {
  file: { id: string; sha256: string; status: string; original_filename: string };
  upload_url: string;
  already_exists: boolean;
};

export type StockLocation = {
  id: string;
  kind: 'warehouse' | 'object';
  title: string;
  erp_object_id: number | null;
};

export type StockBalanceRow = {
  erp_product_id: number;
  product_name: string;
  unit: string;
  qty: string;
  ahhtung: boolean;
};

type KanbanPaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/* ---------- Helper ---------- */

function normalizeList<T>(resp: KanbanPaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object' && 'results' in resp && Array.isArray((resp as KanbanPaginatedResponse<T>).results)) {
    return (resp as KanbanPaginatedResponse<T>).results;
  }
  return [];
}

export function createKanbanService(request: RequestFn) {
  return {
    // Boards
    async listBoards() {
      const resp = await request<KanbanPaginatedResponse<KanbanBoard> | KanbanBoard[]>('/boards/');
      return normalizeList(resp);
    },
    async getBoardByKey(key: string) {
      const resp = await request<KanbanPaginatedResponse<KanbanBoard> | KanbanBoard[]>(`/boards/?key=${encodeURIComponent(key)}`);
      const boards = normalizeList(resp);
      return boards[0] || null;
    },

    // Columns
    async listColumns(boardId: string) {
      const resp = await request<KanbanPaginatedResponse<KanbanColumn> | KanbanColumn[]>(`/columns/?board_id=${encodeURIComponent(boardId)}`);
      return normalizeList(resp);
    },

    // Cards
    async listCards(boardId: string, type?: string) {
      const typeParam = type ? `&type=${encodeURIComponent(type)}` : '';
      const resp = await request<KanbanPaginatedResponse<KanbanCard> | KanbanCard[]>(`/cards/?board_id=${encodeURIComponent(boardId)}${typeParam}`);
      return normalizeList(resp);
    },
    async createCard(data: { board: string; column: string; type: string; title: string; description?: string; meta?: Record<string, unknown> }) {
      return request<KanbanCard>('/cards/', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateCard(cardId: string, data: Partial<{ title: string; description: string; meta: Record<string, unknown>; due_date: string | null }>) {
      return request<KanbanCard>(`/cards/${cardId}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async moveCard(cardId: string, toColumnKey: string) {
      return request<KanbanCard>(`/cards/${cardId}/move/`, { method: 'POST', body: JSON.stringify({ to_column_key: toColumnKey }) });
    },

    // Commercial Cases
    async getCommercialCaseByCard(cardId: string) {
      const resp = await request<KanbanPaginatedResponse<CommercialCase> | CommercialCase[]>(`/commercial/cases/?card=${encodeURIComponent(cardId)}`);
      const list = normalizeList(resp);
      return list[0] || null;
    },
    async createCommercialCase(data: Omit<CommercialCase, 'id' | 'created_at' | 'updated_at'>) {
      return request<CommercialCase>('/commercial/cases/', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateCommercialCase(caseId: string, data: Partial<Omit<CommercialCase, 'id' | 'card' | 'created_at' | 'updated_at'>>) {
      return request<CommercialCase>(`/commercial/cases/${caseId}/`, { method: 'PATCH', body: JSON.stringify(data) });
    },

    // Attachments
    async getCardAttachments(cardId: string) {
      const resp = await request<KanbanPaginatedResponse<KanbanAttachment> | KanbanAttachment[]>(`/cards/${cardId}/attachments/`);
      return normalizeList(resp);
    },
    async attachFileToCard(cardId: string, fileId: string, extra?: { kind?: string; title?: string }) {
      return request<KanbanAttachment>(`/cards/${cardId}/attach_file/`, { method: 'POST', body: JSON.stringify({ file_id: fileId, ...extra }) });
    },

    // File Upload (S3)
    async initFileUpload(data: { sha256: string; size_bytes: number; mime_type: string; original_filename: string }) {
      return request<FileInitResponse>('/files/init/', { method: 'POST', body: JSON.stringify(data) });
    },
    async finalizeFileUpload(fileId: string) {
      return request<{ id: string; status: string }>('/files/finalize/', { method: 'POST', body: JSON.stringify({ file_id: fileId }) });
    },
    async getFileDownloadUrl(fileId: string) {
      return request<{ download_url: string }>(`/files/${fileId}/download_url/`, { method: 'POST' });
    },

    // Warehouse
    async listStockLocations() {
      const resp = await request<KanbanPaginatedResponse<StockLocation> | StockLocation[]>('/stock-locations/');
      return normalizeList(resp);
    },
    async getBalances(locationId: string) {
      return request<{ results: StockBalanceRow[] }>(`/stock-moves/balances/?location_id=${encodeURIComponent(locationId)}`);
    },
  };
}

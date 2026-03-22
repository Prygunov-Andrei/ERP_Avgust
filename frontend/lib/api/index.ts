import { ApiClient } from './client';

export { ApiClient };
export * from './types';
export type {
  KanbanBoard, KanbanColumn, KanbanCard, CardColor, CommercialCase,
  KanbanAttachment, FileInitResponse, StockLocation, StockBalanceRow,
} from './services/kanban';

export const api = new ApiClient();

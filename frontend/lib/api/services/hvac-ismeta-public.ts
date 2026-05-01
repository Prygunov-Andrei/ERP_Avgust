/**
 * Сервис публичного API распознавания спецификаций (hvac-info.com/ismeta).
 * Endpoints: /api/hvac/ismeta/* (через Next.js rewrite на
 * /api/v1/hvac/public/ismeta/*).
 *
 * Mock-режим: NEXT_PUBLIC_ISMETA_MOCK=1 включает hardcoded fixtures —
 * используется до мержа F8-03 backend и в тестах.
 *
 * Анонимный сервис (без auth) — не путать с admin singleton settings из
 * `hvac-ismeta.ts`.
 */

import type {
  IsmetaFeedbackRequest,
  IsmetaJobProgress,
  IsmetaJobResult,
  IsmetaOptions,
  IsmetaParseRequest,
  IsmetaParseResponse,
} from '../types/hvac-ismeta-public';

const BASE = '/api/hvac/ismeta';

function isMock(): boolean {
  return process.env.NEXT_PUBLIC_ISMETA_MOCK === '1';
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || JSON.stringify(body);
    } catch {
      /* not JSON — leave generic */
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export class IsmetaApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'IsmetaApiError';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Real API
// ────────────────────────────────────────────────────────────────────────────

async function realGetOptions(): Promise<IsmetaOptions> {
  return handle<IsmetaOptions>(await fetch(`${BASE}/options`));
}

async function realParsePdf(
  file: File,
  options: IsmetaParseRequest,
): Promise<IsmetaParseResponse> {
  const fd = new FormData();
  fd.append('file', file);
  if (options.pipeline) fd.append('pipeline', options.pipeline);
  if (options.llm_profile_id != null)
    fd.append('llm_profile_id', String(options.llm_profile_id));
  if (options.email) fd.append('email', options.email);

  const res = await fetch(`${BASE}/parse`, { method: 'POST', body: fd });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || JSON.stringify(body);
    } catch {
      /* not JSON */
    }
    throw new IsmetaApiError(res.status, detail);
  }
  return res.json();
}

async function realGetProgress(jobId: string): Promise<IsmetaJobProgress> {
  return handle<IsmetaJobProgress>(
    await fetch(`${BASE}/jobs/${jobId}/progress`),
  );
}

async function realGetResult(jobId: string): Promise<IsmetaJobResult> {
  return handle<IsmetaJobResult>(await fetch(`${BASE}/jobs/${jobId}/result`));
}

async function realSendFeedback(payload: IsmetaFeedbackRequest): Promise<void> {
  const res = await fetch(`${BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new IsmetaApiError(res.status, await res.text());
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Mock (NEXT_PUBLIC_ISMETA_MOCK=1)
// ────────────────────────────────────────────────────────────────────────────

const MOCK_OPTIONS: IsmetaOptions = {
  pipelines: [
    {
      id: 'td17g',
      label: 'Быстрый (TD-17g)',
      description: '~5 мин на спецификацию, $0.36 в среднем',
      default: true,
    },
    {
      id: 'main',
      label: 'Точный (main)',
      description: '~1 час на спецификацию, $1–3 — для сложных случаев',
    },
  ],
  llm_profiles: [
    { id: 1, name: 'OpenAI GPT-4o', vision: true, default: true },
    { id: 2, name: 'OpenAI GPT-4o-mini', vision: true },
    { id: 3, name: 'DeepSeek Chat', vision: false },
    { id: 4, name: 'Gemini 2.5 Pro', vision: true },
  ],
};

interface MockJob {
  id: string;
  startedAt: number;
  pagesTotal: number;
  email?: string;
}
const mockJobs = new Map<string, MockJob>();

function mockSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function mockGetOptions(): Promise<IsmetaOptions> {
  await mockSleep(150);
  return MOCK_OPTIONS;
}

async function mockParsePdf(
  file: File,
  options: IsmetaParseRequest,
): Promise<IsmetaParseResponse> {
  await mockSleep(800);
  // Грубая оценка кол-ва страниц по размеру файла (для прогресса).
  const pagesTotal = Math.max(3, Math.min(60, Math.round(file.size / 150_000)));
  const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  mockJobs.set(id, {
    id,
    startedAt: Date.now(),
    pagesTotal,
    email: options.email,
  });
  return { job_id: id };
}

async function mockGetProgress(jobId: string): Promise<IsmetaJobProgress> {
  await mockSleep(120);
  const job = mockJobs.get(jobId);
  if (!job) {
    throw new IsmetaApiError(404, 'Job not found');
  }
  // Симулируем 5 сек/страницу. Для UI достаточно показать прогресс.
  const elapsed = (Date.now() - job.startedAt) / 1000;
  const pagesProcessed = Math.min(
    job.pagesTotal,
    Math.floor(elapsed / 1.5), // ускоренно для разработки
  );
  const itemsCount = pagesProcessed * 17;
  const status: IsmetaJobProgress['status'] =
    pagesProcessed >= job.pagesTotal ? 'done' : 'processing';
  return {
    status,
    pages_total: job.pagesTotal,
    pages_processed: pagesProcessed,
    items_count: itemsCount,
    error_message: '',
  };
}

async function mockGetResult(jobId: string): Promise<IsmetaJobResult> {
  await mockSleep(200);
  const job = mockJobs.get(jobId);
  if (!job) {
    throw new IsmetaApiError(404, 'Job not found');
  }
  const items = Array.from({ length: 8 }, (_, i) => ({
    position: i + 1,
    name: [
      'Сплит-система настенная',
      'Внешний блок инверторного типа',
      'Дренажная помпа',
      'Кабель межблочный 4×1.5',
      'Магистраль медная 1/4 + 3/8',
      'Кронштейн настенный усиленный',
      'Декоративный канал ПВХ 60×60',
      'Автоматический выключатель C16',
    ][i % 8],
    model: ['AS-12HU', 'OU-12HU', 'PB-100', 'ВВГнг 4×1.5', 'CU 1/4+3/8', 'KU-300', 'TC-60', 'BA47-29'][i % 8],
    qty: i === 4 ? 12 : 1,
    unit: i === 4 ? 'м' : 'шт',
  }));
  return {
    items,
    pages_stats: {
      total: job.pagesTotal,
      processed: job.pagesTotal,
      skipped: 0,
    },
    cost_usd: 0.36,
  };
}

async function mockSendFeedback(_payload: IsmetaFeedbackRequest): Promise<void> {
  await mockSleep(200);
}

// ────────────────────────────────────────────────────────────────────────────
// Public API (mock-aware)
// ────────────────────────────────────────────────────────────────────────────

export const hvacIsmetaPublicService = {
  getOptions: (): Promise<IsmetaOptions> =>
    isMock() ? mockGetOptions() : realGetOptions(),

  parsePdf: (
    file: File,
    options: IsmetaParseRequest = {},
  ): Promise<IsmetaParseResponse> =>
    isMock() ? mockParsePdf(file, options) : realParsePdf(file, options),

  getProgress: (jobId: string): Promise<IsmetaJobProgress> =>
    isMock() ? mockGetProgress(jobId) : realGetProgress(jobId),

  getResult: (jobId: string): Promise<IsmetaJobResult> =>
    isMock() ? mockGetResult(jobId) : realGetResult(jobId),

  /** Direct download URL — `<a href={...} download>`. */
  excelDownloadUrl: (jobId: string): string =>
    `${BASE}/jobs/${jobId}/excel`,

  sendFeedback: (payload: IsmetaFeedbackRequest): Promise<void> =>
    isMock() ? mockSendFeedback(payload) : realSendFeedback(payload),
};

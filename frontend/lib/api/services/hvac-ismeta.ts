/**
 * Сервис настроек публичного сайта ISMeta.
 * Endpoint: /api/v1/hvac/ismeta/settings/ (singleton, GET/PUT/PATCH).
 *
 * Использует прямой fetch — это admin-only одностраничник, не CRUD,
 * нет смысла подключать к ApiClient (который заточен на доменные модули).
 */

import type {
  HvacIsmetaSettings,
  HvacIsmetaSettingsUpdate,
} from '../types/hvac-ismeta';

const ENDPOINT = '/api/v1/hvac/ismeta/settings/';

function authHeader(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function getHvacIsmetaSettings(): Promise<HvacIsmetaSettings> {
  const res = await fetch(ENDPOINT, {
    headers: { ...authHeader() },
  });
  return handle<HvacIsmetaSettings>(res);
}

export async function updateHvacIsmetaSettings(
  data: HvacIsmetaSettingsUpdate,
): Promise<HvacIsmetaSettings> {
  const res = await fetch(ENDPOINT, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
    },
    body: JSON.stringify(data),
  });
  return handle<HvacIsmetaSettings>(res);
}

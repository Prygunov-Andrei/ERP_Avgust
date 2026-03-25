// Конфигурация HVAC API для ERP/HVAC admin.
// Запросы идут через серверный BFF, чтобы сервисный токен не попадал в браузер.

export const API_CONFIG = {
  get BASE_URL() {
    return '/api/hvac-admin/api/hvac';
  },
  get ADMIN_BASE_URL() {
    return '/api/hvac-admin/hvac-admin';
  },
  TIMEOUT: 30000,
  TUNNEL_HEADERS: {},
};

// Базовый URL сервера (без HVAC path prefix)
export const getServerBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://hvac-info.com';
};

// Полный URL для медиа файла
export const getMediaUrl = (path: string): string => {
  if (!path) return '';

  // Абсолютный URL — вернуть как есть (с https fix)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && path.startsWith('http://')) {
      return path.replace('http://', 'https://');
    }
    return path;
  }

  // Относительный путь — добавить origin
  const baseUrl = getServerBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

export const checkApiAvailability = async (): Promise<boolean> => {
  try {
    const token = typeof localStorage !== 'undefined'
      ? localStorage.getItem('access_token')
      : null;
    const response = await fetch(`${API_CONFIG.BASE_URL}/news/`, {
      method: 'HEAD',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
};

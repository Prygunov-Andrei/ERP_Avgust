import axios from 'axios';
import { API_CONFIG } from '../config/api';

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Специальные заголовки больше не нужны
  },
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: false,
});

// Request interceptor — ERP JWT + язык.
// Сам сервисный токен добавляется только на сервере в BFF-маршруте.
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = typeof localStorage !== 'undefined'
      ? localStorage.getItem('access_token')
      : null;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const language = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('language') || 'ru')
      : 'ru';
    config.headers['Accept-Language'] = language;

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — логирование ошибок
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status >= 500) {
      console.error('HVAC API Server Error:', {
        status: error.response.status,
        url: error.config?.url,
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
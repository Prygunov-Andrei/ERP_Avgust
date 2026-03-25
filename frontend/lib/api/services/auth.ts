import type { RequestFn } from './types';
import type { PaginatedResponse } from '../types';

interface User {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  photo_url?: string;
  [key: string]: unknown;
}

const API_BASE_URL = '/api/erp';

export function createAuthService(_request: RequestFn) {
  return {
    async login(username: string, password: string) {
      const body = { username, password };

      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Неверные учётные данные');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      return data;
    },

    async refreshToken(): Promise<boolean> {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        localStorage.setItem('access_token', data.access);
        return true;
      } catch {
        return false;
      }
    },

    logout() {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    },

    async getCurrentUser() {
      return _request('/users/me/');
    },

    async getUsers() {
      const response = await _request<PaginatedResponse<User> | User[]>('/users/');

      if (response && typeof response === 'object' && 'results' in response) {
        return response as PaginatedResponse<User>;
      }
      return { results: response as User[], count: (response as User[]).length, next: null, previous: null };
    },
  };
}

/**
 * Адаптер авторизации для hvac-admin страниц.
 * HVAC admin теперь использует реального ERP-пользователя, а не заглушку.
 */

import { useERPAuth } from '@/hooks/useERPAuth';

export interface HvacUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}

export function useHvacAuth() {
  const { user: erpUser, isAuthenticated, isLoading, handleLogout } = useERPAuth();

  const hvacUser = erpUser
    ? ({
        id: Number(erpUser.id ?? 0),
        email: String(erpUser.email ?? ''),
        first_name: String(erpUser.first_name ?? ''),
        last_name: String(erpUser.last_name ?? ''),
        is_staff: Boolean(erpUser.is_staff || erpUser.is_superuser),
      } satisfies HvacUser)
    : null;

  return {
    user: hvacUser,
    isAuthenticated,
    isLoading,
    login: async () => {},
    logout: handleLogout,
    refreshUser: async () => {},
  };
}

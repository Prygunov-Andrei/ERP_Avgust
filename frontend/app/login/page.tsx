'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Неверные учётные данные');
      }

      const data = await res.json();

      // Сохраняем токены в localStorage (для ERP API клиента)
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);

      // Сохраняем в cookie (для Next.js middleware)
      document.cookie = `access_token=${data.access}; path=/; max-age=${60 * 60}; SameSite=Lax`;

      router.push('/erp/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 text-foreground">
      <div className="w-full max-w-md p-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Август" className="h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-card-foreground">Вход в систему</h1>
            <p className="mt-1 text-sm text-muted-foreground">Финансовая система</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-muted-foreground">
                Имя пользователя
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="admin"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-muted-foreground">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          {/* Back link */}
          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              &larr; Вернуться на главную
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

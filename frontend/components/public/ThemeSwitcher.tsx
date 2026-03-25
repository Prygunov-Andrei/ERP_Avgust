'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const syncDocumentTheme = (isDark: boolean) => {
  const root = document.documentElement;
  const body = document.body;

  root.classList.toggle('dark', isDark);
  root.classList.toggle('theme-dark', isDark);
  root.classList.toggle('theme-light', !isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  body.classList.toggle('dark', isDark);
  body.classList.toggle('theme-dark', isDark);
  body.classList.toggle('theme-light', !isDark);
  body.style.colorScheme = isDark ? 'dark' : 'light';
};

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const initialIsDark =
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark';

    setIsDark(initialIsDark);
    syncDocumentTheme(initialIsDark);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !resolvedTheme) {
      return;
    }

    const nextIsDark = resolvedTheme === 'dark';
    setIsDark(nextIsDark);
    syncDocumentTheme(nextIsDark);
  }, [mounted, resolvedTheme]);

  if (!mounted) {
    return <div className="w-8 h-8" />;
  }

  const handleToggleTheme = () => {
    const nextIsDark = !isDark;

    setIsDark(nextIsDark);
    syncDocumentTheme(nextIsDark);
    setTheme(nextIsDark ? 'dark' : 'light');
  };

  return (
    <button
      onClick={handleToggleTheme}
      className="flex items-center px-2 py-1.5 rounded-md text-foreground hover:bg-accent transition-colors text-lg"
      aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

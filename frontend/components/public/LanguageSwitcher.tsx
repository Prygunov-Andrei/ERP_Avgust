'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Language = 'ru' | 'en' | 'de' | 'pt';

const languages: { code: Language; flag: string; label: string }[] = [
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
];

export function LanguageSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Language>('ru');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && languages.some((l) => l.code === saved)) {
      setCurrent(saved);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchLanguage = (lang: Language) => {
    setCurrent(lang);
    localStorage.setItem('language', lang);
    document.cookie = `language=${lang}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
    setOpen(false);
    router.refresh();
  };

  const currentLang = languages.find((l) => l.code === current)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md text-foreground hover:bg-accent transition-colors text-lg"
        aria-label="Выбрать язык"
      >
        <span>{currentLang.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 min-w-[140px] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1 z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                lang.code === current ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

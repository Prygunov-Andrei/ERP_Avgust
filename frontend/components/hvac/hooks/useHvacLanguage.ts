/**
 * Адаптер языка для hvac-admin страниц.
 * ERP работает только на русском, поэтому язык всегда 'ru'.
 */

export type Language = 'ru' | 'en' | 'de' | 'pt';

export function useHvacLanguage() {
  return {
    language: 'ru' as Language,
    setLanguage: (_lang: Language) => {},
    getLocalizedField: (obj: object | null | undefined, field: string): string => {
      if (!obj) return '';
      const rec = obj as Record<string, unknown>;
      // Пробуем ru-версию поля, затем базовое
      return String(rec[`${field}_ru`] || rec[field] || '');
    },
  };
}

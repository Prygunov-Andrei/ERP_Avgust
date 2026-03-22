import { Language } from '../hooks/useHvacLanguage';

/**
 * Получить локализованное поле из объекта с фоллбэком на русский язык
 * @param obj - объект с мультиязычными полями
 * @param fieldName - базовое имя поля (без суффикса языка)
 * @param language - текущий язык
 * @returns локализованное значение или пустую строку
 *
 * Пример: getLocalizedField(news, 'title', 'en') вернет news.title_en,
 * если его нет - news.title_ru, если и его нет - ''
 */
export function getLocalizedField(
  obj: object | null | undefined,
  fieldName: string,
  language: Language
): string {
  if (!obj) return '';

  const rec = obj as Record<string, unknown>;

  // 1. Пытаемся получить поле для текущего языка
  const localizedFieldName = `${fieldName}_${language}`;
  const localizedValue = rec[localizedFieldName];
  if (typeof localizedValue === 'string' && localizedValue.trim()) {
    return localizedValue;
  }

  // 2. Если нет, пробуем базовое поле без суффикса
  const baseValue = rec[fieldName];
  if (typeof baseValue === 'string' && baseValue.trim()) {
    return baseValue;
  }

  // 3. Fallback на русский язык
  const fallbackFieldName = `${fieldName}_ru`;
  const fallbackValue = rec[fallbackFieldName];
  if (typeof fallbackValue === 'string' && fallbackValue.trim()) {
    return fallbackValue;
  }

  // 4. Если ничего не нашли, возвращаем пустую строку
  return '';
}

/**
 * Получить локализованную дату в формате для конкретного языка
 * @param dateString - строка с датой
 * @param language - текущий язык
 * @returns отформатированная дата
 */
export function getLocalizedDate(
  dateString: string,
  language: Language
): string {
  const date = new Date(dateString);

  const localeMap: Record<Language, string> = {
    ru: 'ru-RU',
    en: 'en-US',
    de: 'de-DE',
    pt: 'pt-PT'
  };

  return date.toLocaleDateString(localeMap[language], {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Получить локализованные данные для массива объектов
 * @param items - массив объектов
 * @param fields - список полей для локализации
 * @param language - текущий язык
 * @returns массив объектов с локализованными полями
 */
export function localizeArray<T extends Record<string, unknown>>(
  items: T[],
  fields: string[],
  language: Language
): T[] {
  return items.map(item => {
    const localizedItem: Record<string, unknown> = { ...item };
    fields.forEach(field => {
      localizedItem[field] = getLocalizedField(item, field, language);
    });
    return localizedItem as T;
  });
}

/**
 * Проверить, доступен ли перевод для указанного языка
 * @param obj - объект с мультиязычными полями
 * @param fieldName - базовое имя поля
 * @param language - язык для проверки
 * @returns true если перевод доступен
 */
export function hasTranslation(
  obj: object | null | undefined,
  fieldName: string,
  language: Language
): boolean {
  if (!obj) return false;

  const rec = obj as Record<string, unknown>;
  const localizedFieldName = `${fieldName}_${language}`;
  const value = rec[localizedFieldName];
  return typeof value === 'string' && Boolean(value.trim());
}

/**
 * Получить список доступных языков для объекта
 * @param obj - объект с мультиязычными полями
 * @param fieldName - базовое имя поля
 * @returns массив доступных языков
 */
export function getAvailableLanguages(
  obj: object | null | undefined,
  fieldName: string
): Language[] {
  if (!obj) return [];

  const rec = obj as Record<string, unknown>;
  const languages: Language[] = ['ru', 'en', 'de', 'pt'];
  return languages.filter(lang => {
    const localizedFieldName = `${fieldName}_${lang}`;
    const value = rec[localizedFieldName];
    return typeof value === 'string' && Boolean(value.trim());
  });
}

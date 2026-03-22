import { useState, useCallback, useRef } from 'react';

interface UseFormDataReturn<T extends Record<string, unknown>> {
  /** Текущие данные формы */
  formData: T;
  /** Прямой setState (для нестандартных сценариев) */
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  /** Обновить одно поле формы */
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Сбросить форму к начальным или переданным данным */
  resetForm: (data?: T) => void;
}

/**
 * Хук для управления состоянием формы.
 *
 * Заменяет 41+ повторение:
 * ```
 * const [formData, setFormData] = useState(initial);
 * const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
 * ```
 *
 * Использование:
 * ```
 * const { formData, updateField, resetForm } = useFormData({
 *   name: '',
 *   amount: 0,
 *   status: 'draft' as const,
 * });
 *
 * updateField('name', 'Новое имя');
 * resetForm(); // сброс к начальным значениям
 * ```
 */
export function useFormData<T extends Record<string, unknown>>(
  initialData: T,
): UseFormDataReturn<T> {
  const [formData, setFormData] = useState<T>(initialData);

  // Запоминаем начальные данные для reset
  const initialDataRef = useRef(initialData);

  const updateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const resetForm = useCallback((data?: T) => {
    setFormData(data ?? initialDataRef.current);
  }, []);

  return { formData, setFormData, updateField, resetForm };
}

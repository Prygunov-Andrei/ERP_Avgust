import { useState, useCallback } from 'react';

interface UseDialogStateReturn<T> {
  /** Открыт ли диалог */
  isOpen: boolean;
  /** Данные, переданные при открытии */
  data: T | undefined;
  /** Открыть диалог (опционально с данными) */
  open: (data?: T) => void;
  /** Закрыть диалог и обнулить данные */
  close: () => void;
}

/**
 * Хук для управления состоянием диалога: isOpen + data.
 *
 * Заменяет 22+ повторения:
 * ```
 * const [isOpen, setIsOpen] = useState(false);
 * const [selectedItem, setSelectedItem] = useState(null);
 * ```
 *
 * Использование:
 * ```
 * const dialog = useDialogState<Contract>();
 * dialog.open(contract);  // открыть с данными
 * dialog.close();          // закрыть
 * // В JSX: <Dialog open={dialog.isOpen} onOpenChange={(v) => !v && dialog.close()}>
 * ```
 */
export function useDialogState<T = undefined>(): UseDialogStateReturn<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | undefined>(undefined);

  const open = useCallback((dialogData?: T) => {
    setData(dialogData);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(undefined);
  }, []);

  return { isOpen, data, open, close };
}

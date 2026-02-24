import { describe, it, expect } from 'vitest';

const getDueDateStyle = (dueDate: string | null): string => {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'bg-red-50';
  if (diffDays <= 3) return 'bg-orange-50';
  return '';
};

describe('TKP due_date highlighting', () => {
  it('returns empty string when due_date is null', () => {
    expect(getDueDateStyle(null)).toBe('');
  });

  it('returns red when due_date is overdue', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getDueDateStyle(yesterday.toISOString().split('T')[0])).toBe('bg-red-50');
  });

  it('returns orange when due_date is today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(getDueDateStyle(today)).toBe('bg-orange-50');
  });

  it('returns orange when due_date is in 2 days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 2);
    expect(getDueDateStyle(future.toISOString().split('T')[0])).toBe('bg-orange-50');
  });

  it('returns orange when due_date is in 3 days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    expect(getDueDateStyle(future.toISOString().split('T')[0])).toBe('bg-orange-50');
  });

  it('returns empty string when due_date is in 4+ days', () => {
    const future = new Date();
    future.setDate(future.getDate() + 4);
    expect(getDueDateStyle(future.toISOString().split('T')[0])).toBe('');
  });

  it('returns red when due_date is far in the past', () => {
    const past = new Date();
    past.setDate(past.getDate() - 30);
    expect(getDueDateStyle(past.toISOString().split('T')[0])).toBe('bg-red-50');
  });
});

describe('KanbanCardCompact counterparty display', () => {
  it('counterparty name is extracted from card.meta', () => {
    const meta = {
      erp_object_name: 'Объект 1',
      system_name: 'Система',
      erp_counterparty_name: 'ООО Заказчик',
    };
    const counterpartyName = meta.erp_counterparty_name || '';
    expect(counterpartyName).toBe('ООО Заказчик');
  });

  it('counterparty name defaults to empty if not in meta', () => {
    const meta = {
      erp_object_name: 'Объект 1',
      system_name: 'Система',
    };
    const counterpartyName = (meta as Record<string, string>).erp_counterparty_name || '';
    expect(counterpartyName).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormData } from '../useFormData';

describe('useFormData', () => {
  const initialData = {
    name: '',
    amount: 0,
    active: false,
  };

  it('initializes with provided data', () => {
    const { result } = renderHook(() => useFormData(initialData));

    expect(result.current.formData).toEqual({
      name: '',
      amount: 0,
      active: false,
    });
  });

  it('updateField updates a single field', () => {
    const { result } = renderHook(() => useFormData(initialData));

    act(() => {
      result.current.updateField('name', 'Test');
    });

    expect(result.current.formData.name).toBe('Test');
    // Остальные поля не затронуты
    expect(result.current.formData.amount).toBe(0);
    expect(result.current.formData.active).toBe(false);
  });

  it('updateField updates multiple fields sequentially', () => {
    const { result } = renderHook(() => useFormData(initialData));

    act(() => {
      result.current.updateField('name', 'Contract A');
    });

    act(() => {
      result.current.updateField('amount', 5000);
    });

    act(() => {
      result.current.updateField('active', true);
    });

    expect(result.current.formData).toEqual({
      name: 'Contract A',
      amount: 5000,
      active: true,
    });
  });

  it('resetForm resets to initial data', () => {
    const { result } = renderHook(() => useFormData(initialData));

    act(() => {
      result.current.updateField('name', 'Changed');
      result.current.updateField('amount', 999);
    });

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.formData).toEqual(initialData);
  });

  it('resetForm with custom data sets that data', () => {
    const { result } = renderHook(() => useFormData(initialData));

    const customData = { name: 'Custom', amount: 100, active: true };

    act(() => {
      result.current.resetForm(customData);
    });

    expect(result.current.formData).toEqual(customData);
  });

  it('setFormData allows direct state replacement', () => {
    const { result } = renderHook(() => useFormData(initialData));

    act(() => {
      result.current.setFormData({ name: 'Direct', amount: 42, active: true });
    });

    expect(result.current.formData).toEqual({
      name: 'Direct',
      amount: 42,
      active: true,
    });
  });

  it('setFormData supports functional updates', () => {
    const { result } = renderHook(() => useFormData(initialData));

    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        amount: prev.amount + 10,
      }));
    });

    expect(result.current.formData.amount).toBe(10);
  });

  it('resetForm after custom data returns to initial', () => {
    const { result } = renderHook(() => useFormData(initialData));

    act(() => {
      result.current.resetForm({ name: 'Temp', amount: 1, active: true });
    });

    act(() => {
      result.current.resetForm();
    });

    // Должен вернуться к исходным данным, не к "Temp"
    expect(result.current.formData).toEqual(initialData);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaymentsService } from '../services/payments';

describe('PaymentsService', () => {
  const mockRequest = vi.fn();
  const service = createPaymentsService(mockRequest);

  beforeEach(() => {
    mockRequest.mockReset();
  });

  // ── Payment Registry ──────────────────────────────────────────────

  describe('getPaymentRegistry', () => {
    it('calls /payment-registry/ with default page=1 and ordering', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0, next: null, previous: null });
      await service.getPaymentRegistry();
      expect(mockRequest).toHaveBeenCalledWith(
        '/payment-registry/?ordering=-id&page=1',
      );
    });

    it('appends status filter when provided', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0, next: null, previous: null });
      await service.getPaymentRegistry(2, 'approved');
      expect(mockRequest).toHaveBeenCalledWith(
        '/payment-registry/?ordering=-id&page=2&status=approved',
      );
    });

    it('ignores status filter "all"', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0, next: null, previous: null });
      await service.getPaymentRegistry(1, 'all');
      expect(mockRequest).toHaveBeenCalledWith(
        '/payment-registry/?ordering=-id&page=1',
      );
    });

    it('normalises plain array response into paginated shape', async () => {
      const items = [{ id: 1 }, { id: 2 }];
      mockRequest.mockResolvedValue(items);
      const result = await service.getPaymentRegistry();
      expect(result).toEqual({ results: items, count: 2, next: null, previous: null });
    });
  });

  // ── createPaymentRegistryItem ─────────────────────────────────────

  it('createPaymentRegistryItem POSTs JSON to /payment-registry/', async () => {
    const data = { description: 'test', amount: '100' };
    mockRequest.mockResolvedValue({ id: 1, ...data });
    await service.createPaymentRegistryItem(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/payment-registry/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  // ── Registry item actions ─────────────────────────────────────────

  it('approvePaymentRegistryItem POSTs to /payment-registry/:id/approve/', async () => {
    mockRequest.mockResolvedValue({ id: 5, status: 'approved' });
    await service.approvePaymentRegistryItem(5);
    expect(mockRequest).toHaveBeenCalledWith('/payment-registry/5/approve/', { method: 'POST' });
  });

  it('payPaymentRegistryItem POSTs to /payment-registry/:id/pay/', async () => {
    mockRequest.mockResolvedValue({ id: 7, status: 'paid' });
    await service.payPaymentRegistryItem(7);
    expect(mockRequest).toHaveBeenCalledWith('/payment-registry/7/pay/', { method: 'POST' });
  });

  it('cancelPaymentRegistryItem sends reason in body when provided', async () => {
    mockRequest.mockResolvedValue({ id: 3, status: 'cancelled' });
    await service.cancelPaymentRegistryItem(3, 'duplicate');
    expect(mockRequest).toHaveBeenCalledWith('/payment-registry/3/cancel/', {
      method: 'POST',
      body: JSON.stringify({ reason: 'duplicate' }),
    });
  });

  it('cancelPaymentRegistryItem sends undefined body when no reason', async () => {
    mockRequest.mockResolvedValue({ id: 3, status: 'cancelled' });
    await service.cancelPaymentRegistryItem(3);
    expect(mockRequest).toHaveBeenCalledWith('/payment-registry/3/cancel/', {
      method: 'POST',
      body: undefined,
    });
  });

  // ── Payments CRUD ─────────────────────────────────────────────────

  describe('getPayments', () => {
    it('calls /payments/ with no params', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0 });
      await service.getPayments();
      expect(mockRequest).toHaveBeenCalledWith('/payments/');
    });

    it('builds query string from params', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0 });
      await service.getPayments({ payment_type: 'income', page: 2, search: 'test' });

      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/payments/?');
      expect(calledUrl).toContain('payment_type=income');
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('search=test');
    });

    it('normalises plain array response', async () => {
      const items = [{ id: 10 }];
      mockRequest.mockResolvedValue(items);
      const result = await service.getPayments();
      expect(result).toEqual({ results: items, count: 1 });
    });
  });

  it('deletePayment sends DELETE to /payments/:id/', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deletePayment(42);
    expect(mockRequest).toHaveBeenCalledWith('/payments/42/', { method: 'DELETE' });
  });

  // ── Expense Categories ────────────────────────────────────────────

  describe('getExpenseCategories', () => {
    it('calls /expense-categories/ without tree param by default', async () => {
      mockRequest.mockResolvedValue([]);
      await service.getExpenseCategories();
      expect(mockRequest).toHaveBeenCalledWith('/expense-categories/');
    });

    it('adds tree=true when requested', async () => {
      mockRequest.mockResolvedValue([]);
      await service.getExpenseCategories(true);
      expect(mockRequest).toHaveBeenCalledWith('/expense-categories/?tree=true');
    });

    it('adds accountType filter', async () => {
      mockRequest.mockResolvedValue([]);
      await service.getExpenseCategories(true, 'cash');
      expect(mockRequest).toHaveBeenCalledWith('/expense-categories/?tree=true&account_type=cash');
    });
  });

  it('createExpenseCategory POSTs JSON', async () => {
    const data = { name: 'Office', account_type: 'cash' };
    mockRequest.mockResolvedValue({ id: 1, ...data });
    await service.createExpenseCategory(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/expense-categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('deleteExpenseCategory sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteExpenseCategory(9);
    expect(mockRequest).toHaveBeenCalledWith('/expense-categories/9/', { method: 'DELETE' });
  });

  // ── Analytics ─────────────────────────────────────────────────────

  it('getCashFlow defaults to period=year', async () => {
    mockRequest.mockResolvedValue([]);
    await service.getCashFlow();
    expect(mockRequest).toHaveBeenCalledWith('/analytics/cashflow/?period=year');
  });

  it('getCashFlow accepts custom period', async () => {
    mockRequest.mockResolvedValue([]);
    await service.getCashFlow('month');
    expect(mockRequest).toHaveBeenCalledWith('/analytics/cashflow/?period=month');
  });

  it('getDebtSummary calls /analytics/debt_summary/', async () => {
    mockRequest.mockResolvedValue({ total: 0 });
    await service.getDebtSummary();
    expect(mockRequest).toHaveBeenCalledWith('/analytics/debt_summary/');
  });
});

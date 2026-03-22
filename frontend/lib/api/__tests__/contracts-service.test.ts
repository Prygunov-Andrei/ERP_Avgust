import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContractsService } from '../services/contracts';

describe('ContractsService', () => {
  const mockRequest = vi.fn();
  const service = createContractsService(mockRequest);

  beforeEach(() => {
    mockRequest.mockReset();
  });

  // ── Framework Contracts ───────────────────────────────────────────

  describe('getFrameworkContracts', () => {
    it('calls /framework-contracts/ with no query when no params', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0 });
      await service.getFrameworkContracts();
      expect(mockRequest).toHaveBeenCalledWith('/framework-contracts/');
    });

    it('builds query string from filter params', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0 });
      await service.getFrameworkContracts({ status: 'active', search: 'test' });

      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=active');
      expect(calledUrl).toContain('search=test');
    });

    it('normalises plain array into paginated shape', async () => {
      const items = [{ id: 1 }, { id: 2 }];
      mockRequest.mockResolvedValue(items);
      const result = await service.getFrameworkContracts();
      expect(result).toEqual({ results: items, count: 2 });
    });
  });

  it('getFrameworkContract fetches by id', async () => {
    mockRequest.mockResolvedValue({ id: 10, name: 'FC-10' });
    await service.getFrameworkContract(10);
    expect(mockRequest).toHaveBeenCalledWith('/framework-contracts/10/');
  });

  it('deleteFrameworkContract sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteFrameworkContract(10);
    expect(mockRequest).toHaveBeenCalledWith('/framework-contracts/10/', { method: 'DELETE' });
  });

  it('createFrameworkContract sends JSON when no file', async () => {
    const data = {
      name: 'FC-1', date: '2024-01-01', valid_from: '2024-01-01',
      valid_until: '2025-01-01', legal_entity: 1, counterparty: 2,
    };
    mockRequest.mockResolvedValue({ id: 1, ...data });
    await service.createFrameworkContract(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/framework-contracts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('createFrameworkContract sends FormData when file present', async () => {
    const file = new File(['dummy'], 'contract.pdf', { type: 'application/pdf' });
    const data = {
      name: 'FC-1', date: '2024-01-01', valid_from: '2024-01-01',
      valid_until: '2025-01-01', legal_entity: 1, counterparty: 2, file,
    };
    mockRequest.mockResolvedValue({ id: 1 });
    await service.createFrameworkContract(data as never);

    expect(mockRequest).toHaveBeenCalledWith('/framework-contracts/', {
      method: 'POST',
      body: expect.any(FormData),
    });
    const formData = mockRequest.mock.calls[0][1].body as FormData;
    expect(formData.get('name')).toBe('FC-1');
    expect(formData.get('file')).toBe(file);
  });

  it('activateFrameworkContract POSTs to /activate/', async () => {
    mockRequest.mockResolvedValue({ status: 'ok' });
    await service.activateFrameworkContract(5);
    expect(mockRequest).toHaveBeenCalledWith('/framework-contracts/5/activate/', { method: 'POST' });
  });

  it('terminateFrameworkContract POSTs to /terminate/', async () => {
    mockRequest.mockResolvedValue({ status: 'ok' });
    await service.terminateFrameworkContract(5);
    expect(mockRequest).toHaveBeenCalledWith('/framework-contracts/5/terminate/', { method: 'POST' });
  });

  // ── Contracts ─────────────────────────────────────────────────────

  describe('getContracts', () => {
    it('calls /contracts/ with no query when no params', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0 });
      await service.getContracts();

      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toBe('/contracts/');
    });

    it('builds query string from multiple params', async () => {
      mockRequest.mockResolvedValue({ results: [], count: 0 });
      await service.getContracts({ object: 3, status: 'active', page: 2 });

      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('object=3');
      expect(calledUrl).toContain('status=active');
      expect(calledUrl).toContain('page=2');
    });
  });

  it('getContractDetail fetches by id', async () => {
    mockRequest.mockResolvedValue({ id: 7 });
    await service.getContractDetail(7);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/7/');
  });

  it('getContractBalance fetches /contracts/:id/balance/', async () => {
    mockRequest.mockResolvedValue({ balance: '10000.00' });
    await service.getContractBalance(7);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/7/balance/');
  });

  it('deleteContract sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteContract(7);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/7/', { method: 'DELETE' });
  });

  it('createContract POSTs JSON when no file', async () => {
    const data = { name: 'C-1', status: 'planned' as const };
    mockRequest.mockResolvedValue({ id: 1 });
    await service.createContract(data);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('updateContract PATCHes JSON when no file', async () => {
    const data = { status: 'active' as const };
    mockRequest.mockResolvedValue({ id: 7 });
    await service.updateContract(7, data);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/7/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  });

  // ── Acts ──────────────────────────────────────────────────────────

  it('getActs with contract id number builds correct query', async () => {
    mockRequest.mockResolvedValue([]);
    await service.getActs(5);
    expect(mockRequest).toHaveBeenCalledWith('/acts/?contract=5');
  });

  it('getActs with params object builds correct query', async () => {
    mockRequest.mockResolvedValue({ results: [] });
    await service.getActs({ contract: 5, status: 'signed' });
    const calledUrl = mockRequest.mock.calls[0][0] as string;
    expect(calledUrl).toContain('contract=5');
    expect(calledUrl).toContain('status=signed');
  });

  it('createAct POSTs JSON to /acts/', async () => {
    const data = { number: 'A-1', contract: 5, date: '2024-06-01', act_type: 'ks2' };
    mockRequest.mockResolvedValue({ id: 1, ...data });
    await service.createAct(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/acts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('signAct POSTs to /acts/:id/sign/', async () => {
    mockRequest.mockResolvedValue({ id: 1, status: 'signed' });
    await service.signAct(1);
    expect(mockRequest).toHaveBeenCalledWith('/acts/1/sign/', { method: 'POST' });
  });

  it('deleteAct sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteAct(1);
    expect(mockRequest).toHaveBeenCalledWith('/acts/1/', { method: 'DELETE' });
  });

  // ── Work Schedule ─────────────────────────────────────────────────

  it('getWorkSchedule fetches items for contract', async () => {
    mockRequest.mockResolvedValue({ results: [{ id: 1 }] });
    const result = await service.getWorkSchedule(3);
    expect(mockRequest).toHaveBeenCalledWith('/work-schedule/?contract=3');
    expect(result).toEqual([{ id: 1 }]);
  });

  it('createWorkScheduleItem POSTs JSON', async () => {
    const data = { contract: 3, name: 'Phase 1', start_date: '2024-01-01', end_date: '2024-03-01' };
    mockRequest.mockResolvedValue({ id: 1, ...data });
    await service.createWorkScheduleItem(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/work-schedule/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('deleteWorkScheduleItem sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteWorkScheduleItem(12);
    expect(mockRequest).toHaveBeenCalledWith('/work-schedule/12/', { method: 'DELETE' });
  });

  // ── Contract Estimates ────────────────────────────────────────────

  it('getContractEstimates filters by contractId', async () => {
    mockRequest.mockResolvedValue({ results: [] });
    await service.getContractEstimates(5);
    expect(mockRequest).toHaveBeenCalledWith('/contract-estimates/?contract=5');
  });

  it('getContractEstimates works without contractId', async () => {
    mockRequest.mockResolvedValue({ results: [] });
    await service.getContractEstimates();
    expect(mockRequest).toHaveBeenCalledWith('/contract-estimates/');
  });

  // ── Accumulative Estimate ─────────────────────────────────────────

  it('getAccumulativeEstimate calls correct endpoint', async () => {
    mockRequest.mockResolvedValue([]);
    await service.getAccumulativeEstimate(8);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/8/accumulative-estimate/');
  });

  it('getEstimateRemainder calls correct endpoint', async () => {
    mockRequest.mockResolvedValue([]);
    await service.getEstimateRemainder(8);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/8/estimate-remainder/');
  });

  it('getEstimateDeviations calls correct endpoint', async () => {
    mockRequest.mockResolvedValue([]);
    await service.getEstimateDeviations(8);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/8/estimate-deviations/');
  });

  // ── Invoice Compliance ────────────────────────────────────────────

  it('checkInvoiceCompliance GETs correct endpoint', async () => {
    mockRequest.mockResolvedValue({ compliant: true });
    await service.checkInvoiceCompliance(99);
    expect(mockRequest).toHaveBeenCalledWith('/contracts/check-invoice/99/');
  });

  it('autoLinkInvoice POSTs to correct endpoint', async () => {
    mockRequest.mockResolvedValue({ linked: true });
    await service.autoLinkInvoice(99);
    expect(mockRequest).toHaveBeenCalledWith(
      '/contracts/auto-link-invoice/99/',
      { method: 'POST' },
    );
  });
});

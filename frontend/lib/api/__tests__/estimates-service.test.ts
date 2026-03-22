import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEstimatesService } from '../services/estimates';

describe('EstimatesService', () => {
  const mockRequest = vi.fn();
  const service = createEstimatesService(mockRequest);

  beforeEach(() => {
    mockRequest.mockReset();
  });

  // ── Projects ──────────────────────────────────────────────────────

  describe('getProjects', () => {
    it('calls /projects/ with no query when no params', async () => {
      mockRequest.mockResolvedValue({ results: [] });
      await service.getProjects();
      expect(mockRequest).toHaveBeenCalledWith('/projects/');
    });

    it('builds query string from params', async () => {
      mockRequest.mockResolvedValue({ results: [] });
      await service.getProjects({ object: 5, stage: 'РД', search: 'heating' });

      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('object=5');
      expect(calledUrl).toContain('search=heating');
    });

    it('normalises plain array response', async () => {
      const items = [{ id: 1 }, { id: 2 }];
      mockRequest.mockResolvedValue(items);
      const result = await service.getProjects();
      expect(result).toEqual(items);
    });
  });

  it('getProjectDetail fetches by id', async () => {
    mockRequest.mockResolvedValue({ id: 3, name: 'Proj-3' });
    await service.getProjectDetail(3);
    expect(mockRequest).toHaveBeenCalledWith('/projects/3/');
  });

  it('createProject POSTs FormData', async () => {
    const formData = new FormData();
    formData.append('name', 'Test');
    mockRequest.mockResolvedValue({ id: 1 });
    await service.createProject(formData);
    expect(mockRequest).toHaveBeenCalledWith('/projects/', {
      method: 'POST',
      body: formData,
    });
  });

  it('createProjectVersion POSTs to /create-version/', async () => {
    mockRequest.mockResolvedValue({ id: 2 });
    await service.createProjectVersion(1);
    expect(mockRequest).toHaveBeenCalledWith('/projects/1/create-version/', { method: 'POST' });
  });

  // ── Project Notes ─────────────────────────────────────────────────

  it('createProjectNote POSTs JSON', async () => {
    const data = { project: 1, text: 'Important note' };
    mockRequest.mockResolvedValue({ id: 1, ...data });
    await service.createProjectNote(data);
    expect(mockRequest).toHaveBeenCalledWith('/project-notes/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('deleteProjectNote sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteProjectNote(5);
    expect(mockRequest).toHaveBeenCalledWith('/project-notes/5/', { method: 'DELETE' });
  });

  // ── Estimates ─────────────────────────────────────────────────────

  describe('getEstimates', () => {
    it('calls /estimates/ with no query when no params', async () => {
      mockRequest.mockResolvedValue({ results: [] });
      await service.getEstimates();
      expect(mockRequest).toHaveBeenCalledWith('/estimates/');
    });

    it('builds query from filter params', async () => {
      mockRequest.mockResolvedValue({ results: [] });
      await service.getEstimates({ object: 2, status: 'draft' });
      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('object=2');
      expect(calledUrl).toContain('status=draft');
    });
  });

  it('getEstimateDetail fetches by id', async () => {
    mockRequest.mockResolvedValue({ id: 10 });
    await service.getEstimateDetail(10);
    expect(mockRequest).toHaveBeenCalledWith('/estimates/10/');
  });

  it('createEstimate POSTs JSON', async () => {
    const data = { name: 'Est-1', object: 1 };
    mockRequest.mockResolvedValue({ id: 1 });
    await service.createEstimate(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/estimates/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('updateEstimate PATCHes JSON', async () => {
    mockRequest.mockResolvedValue({ id: 10 });
    await service.updateEstimate(10, { name: 'Updated' } as never);
    expect(mockRequest).toHaveBeenCalledWith('/estimates/10/', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    });
  });

  it('deleteEstimate sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteEstimate(10);
    expect(mockRequest).toHaveBeenCalledWith('/estimates/10/', { method: 'DELETE' });
  });

  it('createEstimateVersion POSTs to /create-version/', async () => {
    mockRequest.mockResolvedValue({ id: 11 });
    await service.createEstimateVersion(10);
    expect(mockRequest).toHaveBeenCalledWith('/estimates/10/create-version/', { method: 'POST' });
  });

  // ── Estimate Sections ─────────────────────────────────────────────

  it('getEstimateSections fetches by estimateId', async () => {
    mockRequest.mockResolvedValue({ results: [{ id: 1 }] });
    const result = await service.getEstimateSections(5);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-sections/?estimate=5');
    expect(result).toEqual([{ id: 1 }]);
  });

  it('createEstimateSection POSTs JSON', async () => {
    const data = { estimate: 5, name: 'Section A' };
    mockRequest.mockResolvedValue({ id: 1, ...data });
    await service.createEstimateSection(data);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-sections/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('deleteEstimateSection sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteEstimateSection(3);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-sections/3/', { method: 'DELETE' });
  });

  // ── Estimate Items ────────────────────────────────────────────────

  it('getEstimateItems fetches with correct query params', async () => {
    mockRequest.mockResolvedValue({ results: [] });
    await service.getEstimateItems(7);
    expect(mockRequest).toHaveBeenCalledWith(
      '/estimate-items/?estimate=7&ordering=sort_order,item_number&page_size=all',
    );
  });

  it('createEstimateItem POSTs JSON', async () => {
    const data = { estimate: 7, name: 'Cable 3x2.5' };
    mockRequest.mockResolvedValue({ id: 1 });
    await service.createEstimateItem(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-items/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('updateEstimateItem PATCHes JSON', async () => {
    mockRequest.mockResolvedValue({ id: 1 });
    await service.updateEstimateItem(1, { name: 'Updated cable' } as never);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-items/1/', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated cable' }),
    });
  });

  it('deleteEstimateItem sends DELETE', async () => {
    mockRequest.mockResolvedValue(undefined);
    await service.deleteEstimateItem(1);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-items/1/', { method: 'DELETE' });
  });

  // ── Bulk operations ───────────────────────────────────────────────

  it('bulkCreateEstimateItems POSTs items array', async () => {
    const items = [{ estimate: 7, name: 'Item A' }, { estimate: 7, name: 'Item B' }];
    mockRequest.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    await service.bulkCreateEstimateItems(items as never[]);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-items/bulk-create/', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  });

  it('bulkMoveEstimateItems POSTs item_ids and target_position', async () => {
    mockRequest.mockResolvedValue({ moved: 3 });
    await service.bulkMoveEstimateItems([1, 2, 3], 10);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-items/bulk-move/', {
      method: 'POST',
      body: JSON.stringify({ item_ids: [1, 2, 3], target_position: 10 }),
    });
  });

  // ── Auto-match ────────────────────────────────────────────────────

  it('autoMatchEstimateItems sends estimate_id', async () => {
    mockRequest.mockResolvedValue([]);
    await service.autoMatchEstimateItems(7);
    expect(mockRequest).toHaveBeenCalledWith('/estimate-items/auto-match/', {
      method: 'POST',
      body: JSON.stringify({ estimate_id: 7 }),
    });
  });

  it('autoMatchEstimateItems includes optional params', async () => {
    mockRequest.mockResolvedValue([]);
    await service.autoMatchEstimateItems(7, { priceListId: 2, priceStrategy: 'lowest' });

    const body = JSON.parse(mockRequest.mock.calls[0][1].body as string);
    expect(body.estimate_id).toBe(7);
    expect(body.price_list_id).toBe(2);
    expect(body.price_strategy).toBe('lowest');
  });

  // ── Mounting Estimates ────────────────────────────────────────────

  describe('getMountingEstimates', () => {
    it('calls /mounting-estimates/ with no query when no params', async () => {
      mockRequest.mockResolvedValue({ results: [] });
      await service.getMountingEstimates();
      expect(mockRequest).toHaveBeenCalledWith('/mounting-estimates/');
    });

    it('builds query string from params', async () => {
      mockRequest.mockResolvedValue({ results: [] });
      await service.getMountingEstimates({ object: 1, status: 'agreed' });
      const calledUrl = mockRequest.mock.calls[0][0] as string;
      expect(calledUrl).toContain('object=1');
      expect(calledUrl).toContain('status=agreed');
    });
  });

  it('getMountingEstimateDetail fetches by id', async () => {
    mockRequest.mockResolvedValue({ id: 4 });
    await service.getMountingEstimateDetail(4);
    expect(mockRequest).toHaveBeenCalledWith('/mounting-estimates/4/');
  });

  it('createMountingEstimate POSTs JSON', async () => {
    const data = { name: 'ME-1', source_estimate: 7 };
    mockRequest.mockResolvedValue({ id: 1 });
    await service.createMountingEstimate(data as never);
    expect(mockRequest).toHaveBeenCalledWith('/mounting-estimates/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('agreeMountingEstimate POSTs counterparty_id', async () => {
    mockRequest.mockResolvedValue({ id: 4 });
    await service.agreeMountingEstimate(4, 10);
    expect(mockRequest).toHaveBeenCalledWith('/mounting-estimates/4/agree/', {
      method: 'POST',
      body: JSON.stringify({ counterparty_id: 10 }),
    });
  });
});

/**
 * Task #427 (review follow-up) — legacy WO update path (Layer 7 Pending
 * Approval RH snapshot): a PRESENT-but-malformed supplied completion date
 * must FAIL the request (never silently skip the snapshot or default to
 * today), with no RH audit write and no work-order update persisted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const component = {
  cuuid: 'comp-1', id: 'comp-1', name: 'Main Engine', componentCode: '601.001',
  rhCounterType: 'MASTER', rhCurrentMaster: '5000', currentCumulativeRH: '5000',
};

vi.mock('../../storage', () => ({
  storage: {
    getWorkOrder: vi.fn(async () => ({
      id: 'wo-1', workOrderNo: 'WO-1', vesselId: 'v-1', component: 'Main Engine', componentCode: '601.001',
    })),
    getComponents: vi.fn(async () => [component]),
    createRunningHoursAudit: vi.fn(async () => ({})),
    updateWorkOrder: vi.fn(async (_id: string, u: any) => ({ id: 'wo-1', ...u })),
  },
}));
vi.mock('../../modules/running-hours/services/rhTimelineValidationService', () => ({
  validateRHEntry: vi.fn(async () => ({
    isValid: true, validRange: { minRH: 0, maxRH: 999999 }, utilizationRate: 1,
    requiresJustification: false, anomalyFlags: [],
  })),
  getCurrentRH: vi.fn(async () => 5000),
}));
vi.mock('../../modules/sync', () => ({ logFieldChanges: vi.fn(async () => {}) }));

describe('legacy WO Pending Approval — malformed supplied dates are rejected', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a malformed dateOfCompletion with NO audit write and NO WO update', async () => {
    const { workOrderService } = await import('../workOrderService');
    const { storage } = await import('../../storage');
    for (const bad of ['2025-13-40', '15 Sep 2025 99:99', 'not-a-date']) {
      await expect(workOrderService.updateWorkOrder('wo-1', {
        status: 'Pending Approval', currentReading: '4500', dateOfCompletion: bad,
      } as any)).rejects.toThrow(/Invalid completion date/);
    }
    expect((storage as any).createRunningHoursAudit).not.toHaveBeenCalled();
    expect((storage as any).updateWorkOrder).not.toHaveBeenCalled();
  });

  it('accepts a legacy-format date by canonicalizing it, and defaults when absent', async () => {
    const { workOrderService } = await import('../workOrderService');
    const { storage } = await import('../../storage');

    await workOrderService.updateWorkOrder('wo-1', {
      status: 'Pending Approval', currentReading: '4500', dateOfCompletion: '01 Sept 2026 10:15',
    } as any);
    let audit = (storage as any).createRunningHoursAudit.mock.calls[0][0];
    expect(audit.dateUpdatedLocal).toBe('2026-09-01');

    vi.clearAllMocks();
    await workOrderService.updateWorkOrder('wo-1', {
      status: 'Pending Approval', currentReading: '4500',
    } as any);
    audit = (storage as any).createRunningHoursAudit.mock.calls[0][0];
    expect(audit.dateUpdatedLocal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

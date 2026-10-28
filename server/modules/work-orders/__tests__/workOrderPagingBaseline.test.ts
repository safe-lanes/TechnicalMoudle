import { describe, expect, it } from 'vitest';
import {
  compareWorkOrders,
  computeApprovalTierCounts,
  computeWorkOrderTabCounts,
  filterAndSortWorkOrders,
  matchesPeriod,
  matchesSearch,
  matchesTab,
  WORK_ORDER_TABS,
  type FilterableWorkOrder,
} from '@shared/utils/workOrderFilters';
import { parseWorkOrderDate } from '@shared/workOrders/dateParse';

// Characterization only: these assertions intentionally retain existing quirks.
// Do not use them as permission to change production ordering or filter scopes.
describe('Work Order pagination baseline contracts', () => {
  const examples: Record<string, FilterableWorkOrder> = {
    Planned: { status: 'Active', computedStatus: 'Active' },
    Due: { status: 'Active', computedStatus: 'Due' },
    Overdue: { status: 'Active', computedStatus: 'Overdue' },
    Postponed: { status: 'Postponement Approved', computedStatus: 'Postponement Approved' },
    Unplanned: { status: 'Draft', workOrderType: 'Unplanned' },
    'Pending Approval': { status: 'Pending Approval', isExecution: true },
    Completed: { status: 'Closed', computedStatus: 'Closed', isExecution: true },
  };

  it.each(WORK_ORDER_TABS)('retains %s membership and independent badge counts', tab => {
    const rows = Object.values(examples);
    expect(matchesTab(examples[tab], tab)).toBe(true);
    expect(filterAndSortWorkOrders(rows, { activeTab: tab })).toEqual([examples[tab]]);
    expect(computeWorkOrderTabCounts(rows)[tab]).toBe(1);
  });

  it('allows an unplanned pending row to contribute to both badges', () => {
    const row = { workOrderType: 'Unplanned', status: 'Pending Approval', isExecution: true };
    const counts = computeWorkOrderTabCounts([row]);
    expect(counts.Unplanned).toBe(1);
    expect(counts['Pending Approval']).toBe(1);
    expect(counts.Completed).toBe(0);
  });

  it('routes Pending Office Review to Pending Approval', () => {
    expect(matchesTab({ status: 'Pending Office Review' }, 'Pending Approval')).toBe(true);
  });

  it('includes rejected executions in Due but excludes other executions', () => {
    expect(matchesTab({ isExecution: true, status: 'Rejected', computedStatus: 'Due' }, 'Due')).toBe(true);
    expect(matchesTab({ isExecution: true, status: 'Active', computedStatus: 'Due' }, 'Due')).toBe(false);
  });

  it('treats wildcard characters as literal text and does not search components', () => {
    expect(matchesSearch({ jobTitle: 'Inspect 100%_load' }, '%_')).toBe(true);
    expect(matchesSearch({ jobTitle: 'Inspect normal load' }, '%_')).toBe(false);
    expect(matchesSearch({ component: 'engine' }, 'engine')).toBe(false);
    expect(matchesSearch({ templateCode: 'ENGINE-01' }, 'engine')).toBe(true);
  });

  it('keeps toolbar rank equality case-sensitive after trimming the row', () => {
    const row = { status: 'Active', assignedTo: ' Chief Engineer ' };
    expect(filterAndSortWorkOrders([row], { rank: 'Chief Engineer' })).toEqual([row]);
    expect(filterAndSortWorkOrders([row], { rank: 'chief engineer' })).toEqual([]);
  });

  it('uses remaining RH, including negative values, rather than estimated due dates for periods', () => {
    const period = { mode: 'year-only' as const, year: 2024 };
    const row = { maintenanceBasis: 'Running Hours', currentRH: 100, rhEstimatedDueDate: '2099-01-01' };
    expect(matchesPeriod({ ...row, dueRH: 100 + 366 * 24 }, period)).toBe(true);
    expect(matchesPeriod({ ...row, dueRH: 101 + 366 * 24 }, period)).toBe(false);
    expect(matchesPeriod({ ...row, dueRH: 99 }, period)).toBe(true);
    expect(matchesPeriod(row, period)).toBe(false);
  });

  it('treats missing approval tiers as standard without treating unknown tiers as standard', () => {
    expect(computeApprovalTierCounts([{}, { approvalTier: 'standard' }, { approvalTier: 'other' }])).toEqual({
      standard: 2, superintendent_locked: 0, superintendent_notification: 0, ce_with_justification: 0,
    });
  });

  it('sorts execution IDs and submitted dates in approval/history tabs', () => {
    const a = { workOrderNo: 'Z', executionId: 'A', dueDate: '2026-12-01', submittedDate: '2026-01-01' };
    const b = { workOrderNo: 'A', executionId: 'Z', dueDate: '2026-01-01', submittedDate: '2026-12-01' };
    for (const tab of ['Pending Approval', 'Completed']) {
      expect(compareWorkOrders(a, b, 'workOrderNo', 'asc', tab)).toBeLessThan(0);
      expect(compareWorkOrders(a, b, 'dueDate', 'asc', tab)).toBeLessThan(0);
    }
    expect(compareWorkOrders(a, b, 'dueDate', 'asc', 'Due')).toBeGreaterThan(0);
  });

  it('documents the mixed-date comparison cycle blocking a faithful SQL ORDER BY', () => {
    const a = { dueDate: '31-01-2026' };
    const b = { dueDate: '01-02-2026' };
    const c = { dueDate: '15-invalid' };
    expect(parseWorkOrderDate(a.dueDate)?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(parseWorkOrderDate(b.dueDate)?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(parseWorkOrderDate(c.dueDate)).toBeNull();
    // A < B chronologically; B < C and C < A lexically. No transitive
    // ordering can satisfy all three. A unique ID tie-breaker cannot fix this:
    // every comparison is nonzero, not a tie.
    expect(compareWorkOrders(a, b, 'dueDate', 'asc', 'Due')).toBeLessThan(0);
    expect(compareWorkOrders(b, c, 'dueDate', 'asc', 'Due')).toBeLessThan(0);
    expect(compareWorkOrders(c, a, 'dueDate', 'asc', 'Due')).toBeLessThan(0);
    expect(compareWorkOrders(a, b, 'dueDate', 'desc', 'Due')).toBeGreaterThan(0);
    expect(compareWorkOrders(b, c, 'dueDate', 'desc', 'Due')).toBeGreaterThan(0);
    expect(compareWorkOrders(c, a, 'dueDate', 'desc', 'Due')).toBeGreaterThan(0);
  });
});

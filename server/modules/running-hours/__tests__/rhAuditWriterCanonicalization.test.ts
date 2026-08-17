/**
 * Task #427 (review follow-up) — direct RH audit writers and the timeline
 * validation reader must obey the canonical calendar-day contract:
 *  - createAudit canonicalizes date_updated_local and REJECTS unparseable dates
 *    (never silently persists raw text).
 *  - rhTimelineValidationService parses via the shared strict parser: legacy
 *    long-month rows normalize, unparseable rows fall back to the entry day,
 *    ordering is NaN-safe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/runningHoursRepository', () => ({
  createRunningHoursAudit: vi.fn(async (d: any) => ({ id: 1, ...d })),
  getRunningHoursAudits: vi.fn(async () => []),
  getComponent: vi.fn(async (id: string) => ({
    cuuid: id, id, vesselId: 'v-1', rhCounterType: 'INHERITED',
    currentCumulativeRH: '100.00', lastUpdated: '2026-08-01',
  })),
  updateComponent: vi.fn(async () => ({})),
}));
vi.mock('../../../storage', () => ({
  storage: {
    cascadeRunningHoursUpdate: vi.fn(async () => ({ updated: 0 })),
    updateChildRhWithStampAccrual: vi.fn(async () => ({})),
    updateRunningHoursBulk: vi.fn(async () => ({})),
    setComponentRunningHours: vi.fn(async () => ({})),
  },
}));

import * as repo from '../repositories/runningHoursRepository';

const baseAudit = {
  componentId: 'c-1',
  vesselId: 'v-1',
  previousRH: '100',
  newRH: '150',
  cumulativeRH: '150',
  dateUpdatedTZ: 'UTC',
  enteredAtUTC: new Date('2026-08-15T10:00:00Z'),
  userId: 'tester',
  source: 'single',
};

describe('createAudit canonicalizes date_updated_local', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts a legacy long-month date to canonical YYYY-MM-DD', async () => {
    const { createAudit } = await import('../services/runningHoursService');
    await createAudit({ ...baseAudit, dateUpdatedLocal: '01 Sept 2026 10:15' });
    const persisted = (repo.createRunningHoursAudit as any).mock.calls[0][0];
    expect(persisted.dateUpdatedLocal).toBe('2026-09-01');
  });

  it('passes already-canonical ISO through unchanged', async () => {
    const { createAudit } = await import('../services/runningHoursService');
    await createAudit({ ...baseAudit, dateUpdatedLocal: '2026-08-15' });
    expect((repo.createRunningHoursAudit as any).mock.calls[0][0].dateUpdatedLocal).toBe('2026-08-15');
  });

  it('REJECTS unparseable / malformed dates instead of persisting raw text', async () => {
    const { createAudit } = await import('../services/runningHoursService');
    for (const bad of ['2025-13-40', '15 Sep 2025 99:99', 'not-a-date']) {
      await expect(createAudit({ ...baseAudit, dateUpdatedLocal: bad })).rejects.toThrow(/Invalid reading date/);
    }
    expect(repo.createRunningHoursAudit).not.toHaveBeenCalled();
  });
});

describe('RH boundaries reject present-but-unparseable dates (absent may default)', () => {
  beforeEach(() => vi.clearAllMocks());
  const MALFORMED = ['2025-13-40', '15 Sep 2025 99:99', 'not-a-date'];

  it('requireReadingDayInput: null/empty → null (caller defaults); malformed → throws', async () => {
    const { requireReadingDayInput, InvalidReadingDateError } = await import('../utils/readingDate');
    expect(requireReadingDayInput(null)).toBeNull();
    expect(requireReadingDayInput(undefined)).toBeNull();
    expect(requireReadingDayInput('  ')).toBeNull();
    expect(requireReadingDayInput('01 Sept 2026 10:15')).toBe('2026-09-01');
    for (const bad of MALFORMED) {
      expect(() => requireReadingDayInput(bad)).toThrow(InvalidReadingDateError);
    }
  });

  it('cascadeUpdate rejects a malformed dateUpdated with NO writes', async () => {
    const svc = await import('../services/runningHoursService');
    const { storage } = await import('../../../storage');
    for (const bad of MALFORMED) {
      await expect(svc.cascadeUpdate({
        parentComponentId: 'c-1', newRHValue: 200, updateSource: 'MANUAL',
        userId: 'tester', dateUpdated: bad,
        // Zod schema may reject the shape first; either way it must REJECT, never default to today.
      })).rejects.toThrow(/Invalid (reading date|cascade data)/);
    }
    expect(repo.createRunningHoursAudit).not.toHaveBeenCalled();
    expect((storage as any).cascadeRunningHoursUpdate).not.toHaveBeenCalled();
  });

  it('updateChildRH rejects a malformed dateUpdated with NO writes', async () => {
    const svc = await import('../services/runningHoursService');
    const { storage } = await import('../../../storage');
    for (const bad of MALFORMED) {
      await expect(svc.updateChildRH('c-1', {
        newRHValue: 200, userId: 'tester', dateUpdated: bad,
      } as any)).rejects.toThrow(/Invalid reading date/);
    }
    expect(repo.createRunningHoursAudit).not.toHaveBeenCalled();
    expect((storage as any).updateChildRhWithStampAccrual).not.toHaveBeenCalled();
  });

  it('updateMasterRH rejects a malformed dateUpdated with NO writes', async () => {
    const svc = await import('../services/runningHoursService');
    const { storage } = await import('../../../storage');
    for (const bad of MALFORMED) {
      await expect(svc.updateMasterRH('c-1', {
        newRHValue: 200, updateSource: 'MANUAL', userId: 'tester', dateUpdated: bad,
      })).rejects.toThrow(/Invalid reading date/);
    }
    expect(repo.createRunningHoursAudit).not.toHaveBeenCalled();
    expect((storage as any).cascadeRunningHoursUpdate).not.toHaveBeenCalled();
  });
});

describe('rhTimelineValidationService uses the shared strict parser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes legacy rows, falls back to entry day for unparseable rows, orders NaN-safe', async () => {
    (repo.getRunningHoursAudits as any).mockResolvedValue([
      { id: 3, dateUpdatedLocal: 'garbage-text', enteredAtUTC: new Date('2026-08-20T09:00:00Z'), cumulativeRH: '300', source: 'single' },
      { id: 1, dateUpdatedLocal: '01 Sept 2026 10:15', enteredAtUTC: new Date('2026-08-01T09:00:00Z'), cumulativeRH: '100', source: 'single' },
      { id: 2, dateUpdatedLocal: '2026-08-10', enteredAtUTC: new Date('2026-08-10T09:00:00Z'), cumulativeRH: '200', source: 'single' },
    ]);
    const svc = await import('../services/rhTimelineValidationService');
    const range = await svc.getValidRange('c-1', '2026-08-25');
    // Timeline days: 2026-08-10 (ISO), 2026-08-20 (entry-day fallback), 2026-09-01 (legacy long month).
    // For target 2026-08-25: previous entry is the garbage row's entry day, next is the Sept row.
    expect(range.previousEntry?.date).toBe('2026-08-20');
    expect(range.previousEntry?.runningHours).toBe(300);
    expect(range.nextEntry?.date).toBe('2026-09-01');
    expect(Number.isFinite(range.minRH)).toBe(true);
    expect(Number.isFinite(range.maxRH)).toBe(true);
  });
});

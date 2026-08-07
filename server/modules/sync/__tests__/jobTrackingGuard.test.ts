import { describe, it, expect } from 'vitest';
import { evaluateJobTrackingGuard, JOB_TRACKING_COLUMNS } from '../oneWayApplier';

const localWithTracking = {
  last_done_date: '01-Jul-2026',
  next_due_date: '01-Oct-2026',
  last_done_rh: '12000',
  next_due_rh: '12500',
  tracking_rebaselined_at: null,
};

describe('evaluateJobTrackingGuard (one-way applier, migration 161)', () => {
  it('strips all tracking columns when local values are non-NULL and no rebaseline stamp', () => {
    const strip = evaluateJobTrackingGuard(localWithTracking, {
      last_done_date: '01-Jan-2026', next_due_date: '01-Apr-2026',
    });
    for (const col of JOB_TRACKING_COLUMNS) expect(strip).toContain(col);
    expect(strip).toContain('tracking_rebaselined_at');
  });

  it('lets values through on fresh provisioning (local tracking all NULL)', () => {
    const strip = evaluateJobTrackingGuard(
      { last_done_date: null, next_due_date: null, last_done_rh: null, next_due_rh: null, tracking_rebaselined_at: null },
      { last_done_date: '01-Jan-2026' },
    );
    expect(strip).toHaveLength(0);
  });

  it('strips only the columns with local non-NULL values (per-column)', () => {
    const strip = evaluateJobTrackingGuard(
      { ...localWithTracking, last_done_rh: null, next_due_rh: null },
      {},
    );
    expect(strip).toContain('last_done_date');
    expect(strip).toContain('next_due_date');
    expect(strip).not.toContain('last_done_rh');
    expect(strip).not.toContain('next_due_rh');
  });

  it('authorized rebaseline: newer incoming stamp lets shore values through', () => {
    const strip = evaluateJobTrackingGuard(
      { ...localWithTracking, tracking_rebaselined_at: '2026-08-01T00:00:00Z' },
      { tracking_rebaselined_at: '2026-08-05T00:00:00Z', last_done_date: '01-Jan-2020' },
    );
    expect(strip).toHaveLength(0);
  });

  it('stale or equal rebaseline stamp does NOT authorize overwrite', () => {
    const local = { ...localWithTracking, tracking_rebaselined_at: '2026-08-05T00:00:00Z' };
    expect(evaluateJobTrackingGuard(local, { tracking_rebaselined_at: '2026-08-05T00:00:00Z' }).length).toBeGreaterThan(0);
    expect(evaluateJobTrackingGuard(local, { tracking_rebaselined_at: '2026-08-01T00:00:00Z' }).length).toBeGreaterThan(0);
    expect(evaluateJobTrackingGuard(local, { tracking_rebaselined_at: 'not-a-date' }).length).toBeGreaterThan(0);
  });

  it('rebaseline stamp against NULL local stamp authorizes overwrite', () => {
    const strip = evaluateJobTrackingGuard(localWithTracking, { tracking_rebaselined_at: '2026-08-05T00:00:00Z' });
    expect(strip).toHaveLength(0);
  });
});

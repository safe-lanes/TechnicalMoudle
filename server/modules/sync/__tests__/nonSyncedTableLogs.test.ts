import { describe, expect, it } from 'vitest';
import { SYNC_CONFIG, requiresFieldLogging, getSyncPhaseOrder } from '../../../../shared/syncConfig';
import { partitionNonSyncedTableLogs } from '../service';

// 26-Oct-2026 — defect_sequences is a per-side counter and must never travel (dev vessel 74481b72 / Testvessel:
// "recovery group for an ABSENT row is missing NOT-NULL column(s) [year]" re-offered on every pull, drain no-progress).
describe('defect_sequences never syncs', () => {
  it('is NO_SYNC, not field-logged, not provisioned', () => {
    expect(SYNC_CONFIG.defect_sequences.category).toBe('NO_SYNC');
    expect(requiresFieldLogging('defect_sequences')).toBe(false);
    expect(getSyncPhaseOrder().flat()).not.toContain('defect_sequences');
  });
});

describe('partitionNonSyncedTableLogs (stale logs of a table that no longer syncs are retired, the rest offered)', () => {
  const logs = [
    { logUuid: 'a', tableName: 'defects' },
    { logUuid: 'b', tableName: 'defect_sequences' },
    { logUuid: 'c', tableName: 'spares' },
    { logUuid: 'd', tableName: 'defect_sequences' },
    { logUuid: 'e', tableName: 'apprv_workflows' }, // NO_SYNC engine table — never field-logged, but retire if ever seen
  ];
  it('keeps BOTH_EDITABLE tables and retires the others, order preserved', () => {
    const { kept, retired } = partitionNonSyncedTableLogs(logs);
    expect(kept.map((l) => l.logUuid)).toEqual(['a', 'c']);
    expect(retired.map((l) => l.logUuid)).toEqual(['b', 'd', 'e']);
  });
  it('nothing to retire → everything kept', () => {
    const { kept, retired } = partitionNonSyncedTableLogs([{ logUuid: 'a', tableName: 'defects' }]);
    expect(kept).toHaveLength(1); expect(retired).toHaveLength(0);
  });
});

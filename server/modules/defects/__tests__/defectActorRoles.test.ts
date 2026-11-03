import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('../../approvals/approvalHistoryRepository', () => ({ lookupAccountRoles: lookup }));
import { loadDefectActorRoles } from '../services/defectActorRoles';
import { buildApprovalProcess } from '../../approvals/approvalHistoryService';

beforeEach(() => vi.resetAllMocks());

describe('read-only Defect actor role enrichment', () => {
  it('batches unique stable actor identities, independent of viewer, name, rank or configured role', async () => {
    lookup.mockResolvedValue(new Map([['actor-a', 'Sail Admin'], ['actor-b', 'Technical Superintendent']]));
    const roles = await loadDefectActorRoles(['actor-a', 'actor-a', 'actor-b', null, undefined, '', 'system']);
    expect(lookup).toHaveBeenCalledExactlyOnceWith(['actor-a', 'actor-b']);
    const rows = ['actor-a', 'actor-b', 'unknown', null].map(actorUuid => ({
      actorUuid, actorName: 'Duplicate Name', actorPosition: 'Master', stepLabel: 'Configured Role',
      eventType: 'approved', occurredAt: new Date('2026-11-03T08:00:00Z'), remarks: 'Original explanation',
    }));
    const original = structuredClone(rows);
    for (const subject of ['defect-extension', 'defect-verification']) {
      const events = buildApprovalProcess(subject, rows, [], roles).attempts[0].events;
      expect(events.map(e => e.byRole)).toEqual(['Sail Admin', 'Technical Superintendent', null, null]);
      expect(events.every(e => e.byName === 'Duplicate Name' && e.byPosition === 'Master' && e.remarks === 'Original explanation')).toBe(true);
    }
    expect(rows).toEqual(original);
    expect(buildApprovalProcess('wo-completion', rows, [], roles).attempts[0].events[0]).not.toHaveProperty('byRole');
    expect(buildApprovalProcess('defect-extension', rows).attempts[0].events[0]).not.toHaveProperty('byRole');
  });
  it('retains unknown/legacy actors without inferring their role from a designation', async () => {
    lookup.mockResolvedValue(new Map());
    const roles = await loadDefectActorRoles(['deleted-account']);
    const result = buildApprovalProcess('defect-verification', [], [
      { type: 'approved', byName: 'Legacy Verifier', byPosition: 'Marine Manager', at: null },
    ], roles);
    expect(result.attempts[0].events[0]).toMatchObject({ byName: 'Legacy Verifier', byPosition: 'Marine Manager', byRole: null });
  });
  it('skips empty lookups and retains history when vessel user-master lookup fails', async () => {
    expect(await loadDefectActorRoles([null, '', 'system'])).toEqual(new Map());
    expect(lookup).not.toHaveBeenCalled();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    lookup.mockRejectedValue(new Error('master data unavailable on vessel'));
    expect(await loadDefectActorRoles(['actor-a'])).toEqual(new Map());
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});

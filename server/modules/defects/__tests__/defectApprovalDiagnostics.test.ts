import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveRoleApproverUserIds: vi.fn(),
  isApprovalEngineAvailable: vi.fn(),
  select: vi.fn(),
}));

vi.mock('../../../postgresClient', () => ({ getPostgresClient: () => ({ db: { select: mocks.select } }) }));
vi.mock('../../../utils/asyncLocalStorage', () => ({ getCurrentTenantContext: () => null }));
vi.mock('../../approvals/approvalCard', () => ({
  DEFECTS_EXTENSION_SCREEN: 'defects-extension',
  DEFECTS_REPEAT_EXTENSION_SCREEN: 'defects-repeat-extension',
  DEFECTS_VERIFICATION_SCREEN: 'defects-verification',
  DEFECT_CLASS_NORMAL: 'Normal',
  DEFECT_CLASS_CRITICAL: 'Critical Equipment / COC Related',
  classifyDefect: vi.fn(),
  deciderIdentity: vi.fn(),
  resolveRoleApproverUserIds: mocks.resolveRoleApproverUserIds,
}));
vi.mock('../../approvals/engineGateway', () => ({
  isApprovalEngineAvailable: mocks.isApprovalEngineAvailable,
  scopeFor: (moduleId: string, screenId: string) => ({ moduleId, screenId, actionId: '' }),
}));

import { getDefectApprovalDiagnostics } from '../services/defectsService';

function mockDb(data: {
  workflows?: any[]; nodes?: any[]; slots?: any[]; defects?: any[];
  requests?: any[]; returnedRequests?: any[]; requestSlots?: any[];
}) {
  const rows = {
    workflows: data.workflows ?? [], nodes: data.nodes ?? [], slots: data.slots ?? [],
    defects: data.defects ?? [], requests: data.requests ?? [],
    returnedRequests: data.returnedRequests ?? [], requestSlots: data.requestSlots ?? [],
  };
  mocks.select.mockImplementation((fields: any) => ({
    from: () => {
      const keys = Object.keys(fields);
       const group = keys.includes('classification') ? 'workflows'
         : keys.includes('finalizedAt') ? 'returnedRequests'
         : keys.includes('subjectRef') ? 'requests'
            : keys.includes('duuid') ? 'defects'
              : keys.includes('roleId') ? 'slots' : 'nodes';
      const query = { where: async () => {
        if (group === 'requests') {
          return rows.requests.flatMap((request) => {
            const slots = rows.requestSlots.filter((slot) => slot.requuid === request.requuid);
            return slots.length ? slots.map((slot) => ({ ...request, slotRequuid: slot.requuid, nodeKey: slot.nodeKey, slotOrdinal: slot.slotOrdinal, resolved: slot.resolved, slotStatus: slot.status }))
              : [{ ...request, slotRequuid: null, nodeKey: null, slotOrdinal: null, resolved: null, slotStatus: null }];
          });
        }
        return rows[group as keyof typeof rows];
      } };
      return { leftJoin: () => query, ...query };
    },
  }));
}

describe('Defects approval diagnostics aggregation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isApprovalEngineAvailable.mockReturnValue(true);
    mocks.resolveRoleApproverUserIds.mockResolvedValue(['approver-1']);
  });

  it('reports all six workflow combinations, role×vessel resolution, stalled slots, and orphans', async () => {
    mocks.resolveRoleApproverUserIds.mockImplementation(async (_roleId, vesselId) =>
      vesselId === 'V1' ? [] : ['approver-1']);
    mockDb({
      workflows: [
        { wfuuid: 'wf-1', screenId: 'defects-extension', classification: 'Normal' },
        { wfuuid: 'wf-2', screenId: 'defects-verification', classification: 'Critical Equipment / COC Related' },
      ],
      nodes: [{ workflowWfuuid: 'wf-1', nodeKey: 'step-1' }],
      slots: [{ workflowWfuuid: 'wf-1', nodeKey: 'step-1', roleId: 'role-1', roleLabel: 'Master' }],
      defects: [
        { duuid: 'D-open', vesselId: 'V1', status: 'Open', isDeleted: false, targetDateExtensions: [{ id: 'orphan', status: 'Requested', requestedAt: '2026-01-02' }] },
        { duuid: 'D-pending', vesselId: 'V2', status: 'Open', isDeleted: false, targetDateExtensions: [
          { id: 'owned', status: 'Requested', requestedAt: '2026-01-03' },
          { id: 'extra', status: 'Requested', requestedAt: '2026-01-04' },
        ] },
        { duuid: 'D-closed', vesselId: 'V1', status: 'Closed', isDeleted: false, targetDateExtensions: [{ id: 'closed', status: 'Requested', requestedAt: '2026-01-04' }] },
      ],
      requests: [{ requuid: 'R1', subjectRef: 'D-pending', vesselId: 'V2', submittedAt: '2026-01-01T00:00:00.000Z', screenId: 'defects-extension' }],
      requestSlots: [{ requuid: 'R1', nodeKey: 'step-1', slotOrdinal: 0, resolved: [], status: 'active' }],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.missingActiveWorkflows).toHaveLength(4);
    expect(result.roleCoverage).toHaveLength(1);
    expect(mocks.resolveRoleApproverUserIds).toHaveBeenCalledTimes(2);
    expect(result.unresolvedApprovers[0]?.workflowScopes).toEqual(['defects-extension:Normal']);
    expect(result.stalledRequests).toHaveLength(1);
    expect(result.stalledRequests[0]).toMatchObject({ defectId: 'D-pending', vesselId: 'V2' });
    expect(result.orphanRequestedExtensions).toHaveLength(2);
    expect(result.orphanRequestedExtensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ defectId: 'D-open', requestedAt: '2026-01-02' }),
      expect.objectContaining({ defectId: 'D-pending', entryId: 'extra', requestedAt: '2026-01-04' }),
    ]));
     expect(result.queryPlan.expectedQueries).toBe(6 + 3 * 2);
     expect(mocks.select).toHaveBeenCalledTimes(6);
    expect(result.missingActiveWorkflows.find((gap) =>
      gap.screenId === 'defects-repeat-extension' && gap.classification === 'Normal')?.consequence)
      .toBe('Repeat extensions in this classification will fall back to the initial extension workflow until this is configured.');
    expect(result.missingActiveWorkflows.find((gap) =>
      gap.screenId === 'defects-extension' && gap.classification === 'Critical Equipment / COC Related')?.consequence)
      .toBe('Initial extension approval has no alternate fallback; repeat requests relying on this fallback cannot complete through approval until the initial extension workflow is configured.');
    expect(result.missingActiveWorkflows.find((gap) =>
      gap.screenId === 'defects-verification' && gap.classification === 'Normal')?.consequence)
      .toBe('Verification C2 cannot complete through approval until this is configured.');
    expect(result.workflowMatrix.find((gap) => gap.scope === 'defects-repeat-extension' && gap.classification === 'Normal')?.consequence)
      .toBe('Repeat extensions in this classification will fall back to the initial extension workflow until this is configured.');
  });

  it('returns an explicit healthy empty state with no resolver work', async () => {
    mockDb({ workflows: [
      ...['defects-extension', 'defects-repeat-extension', 'defects-verification'].flatMap((screenId) => [
        { wfuuid: `${screenId}-n`, screenId, classification: 'Normal' },
        { wfuuid: `${screenId}-c`, screenId, classification: 'Critical Equipment / COC Related' },
       ])
     ] });
    const result = await getDefectApprovalDiagnostics();
    expect(result).toMatchObject({ available: true, healthy: true });
    expect(result.missingActiveWorkflows).toEqual([]);
    expect(result.stalledRequests).toEqual([]);
    expect(result.orphanRequestedExtensions).toEqual([]);
    expect(mocks.resolveRoleApproverUserIds).not.toHaveBeenCalled();
     expect(result.queryPlan.expectedQueries).toBe(6);
  });

  it('flags returned verification requests whose defect remains verified', async () => {
    mockDb({
      defects: [{
        duuid: 'D-split', vesselId: 'V1', status: 'Closed', verified: true,
        isDeleted: false, targetDateExtensions: [],
      }],
      returnedRequests: [{
        requuid: 'R-returned', subjectRef: 'D-split', vesselId: 'V1',
        finalizedAt: '2026-09-16T08:00:00.000Z',
      }],
    });

    const result = await getDefectApprovalDiagnostics();
    expect(result.returnedVerificationStillVerified).toEqual([
      expect.objectContaining({
        requestUuid: 'R-returned',
        defectId: 'D-split',
        vesselId: 'V1',
      }),
    ]);
    expect(result.summary.returnedVerificationStillVerified).toBe(1);
    expect(result.healthy).toBe(false);
  });
});
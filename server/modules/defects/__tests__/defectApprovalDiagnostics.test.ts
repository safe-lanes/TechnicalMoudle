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
  roles?: any[]; requests?: any[]; terminalRequests?: any[]; returnedRequests?: any[]; requestSlots?: any[];
}) {
  const rows = {
    workflows: data.workflows ?? [], nodes: data.nodes ?? [], slots: data.slots ?? [],
    roles: data.roles ?? [{ roleId: 'role-1', roleName: 'Master' }],
    defects: data.defects ?? [], requests: data.requests ?? [],
    returnedRequests: data.terminalRequests ?? data.returnedRequests ?? [], requestSlots: data.requestSlots ?? [],
  };
  mocks.select.mockImplementation((fields: any) => ({
    from: () => {
      const keys = Object.keys(fields);
       const group = keys.includes('classification') ? 'workflows'
         : keys.includes('roleName') ? 'roles'
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
     expect(result.queryPlan.expectedQueries).toBe(7 + 3 * 2);
     expect(mocks.select).toHaveBeenCalledTimes(7);
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
     expect(result.queryPlan.expectedQueries).toBe(7);
  });

  it('flags returned verification requests whose defect remains verified', async () => {
    mockDb({
      defects: [{
        duuid: 'D-split', vesselId: 'V1', status: 'Closed', verified: true,
        isDeleted: false, targetDateExtensions: [],
      }],
      returnedRequests: [{
        requuid: 'R-returned', subjectRef: 'D-split', vesselId: 'V1',
        status: 'returned', submittedAt: '2026-09-16T07:55:00.000Z',
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

  it('does not flag an older return when a later verification was approved', async () => {
    mockDb({
      defects: [{ duuid: 'D-reclosed', vesselId: 'V1', status: 'Closed', verified: true, isDeleted: false, targetDateExtensions: [] }],
      terminalRequests: [
        { requuid: 'R-returned', subjectRef: 'D-reclosed', vesselId: 'V1', status: 'returned', submittedAt: '2026-09-16T08:00:00Z', finalizedAt: '2026-09-16T08:05:00Z' },
        { requuid: 'R-approved', subjectRef: 'D-reclosed', vesselId: 'V1', status: 'approved', submittedAt: '2026-09-16T09:00:00Z', finalizedAt: '2026-09-16T09:05:00Z' },
      ],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.returnedVerificationStillVerified).toEqual([]);
  });

  it('does not flag a returned request when the defect is correctly unverified', async () => {
    mockDb({
      defects: [{ duuid: 'D-open', vesselId: 'V1', status: 'Open', verified: false, isDeleted: false, targetDateExtensions: [] }],
      terminalRequests: [{ requuid: 'R-returned', subjectRef: 'D-open', vesselId: 'V1', status: 'returned', submittedAt: '2026-09-16T08:00:00Z', finalizedAt: '2026-09-16T08:05:00Z' }],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.returnedVerificationStillVerified).toEqual([]);
  });

  it('uses timestamps rather than returned row order to find the latest decision', async () => {
    mockDb({
      defects: [{ duuid: 'D-order', vesselId: 'V1', status: 'Closed', verified: true, isDeleted: false, targetDateExtensions: [] }],
      terminalRequests: [
        { requuid: 'R-approved-latest', subjectRef: 'D-order', vesselId: 'V1', status: 'approved', submittedAt: '2026-09-16T10:00:00Z', finalizedAt: '2026-09-16T10:05:00Z' },
        { requuid: 'R-returned-older', subjectRef: 'D-order', vesselId: 'V1', status: 'returned', submittedAt: '2026-09-16T08:00:00Z', finalizedAt: '2026-09-16T08:05:00Z' },
      ],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.returnedVerificationStillVerified).toEqual([]);
  });

  it('falls back to submitted time when finalization time is null', async () => {
    mockDb({
      defects: [{ duuid: 'D-null-finalized', vesselId: 'V1', status: 'Closed', verified: true, isDeleted: false, targetDateExtensions: [] }],
      terminalRequests: [
        { requuid: 'R-returned', subjectRef: 'D-null-finalized', vesselId: 'V1', status: 'returned', submittedAt: '2026-09-16T08:00:00Z', finalizedAt: '2026-09-16T08:05:00Z' },
        { requuid: 'R-approved', subjectRef: 'D-null-finalized', vesselId: 'V1', status: 'approved', submittedAt: '2026-09-16T10:00:00Z', finalizedAt: null },
      ],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.returnedVerificationStillVerified).toEqual([]);
  });

  it('flags conservatively when latest effective timestamps tie across decisions', async () => {
    mockDb({
      defects: [{ duuid: 'D-tie', vesselId: 'V1', status: 'Closed', verified: true, isDeleted: false, targetDateExtensions: [] }],
      terminalRequests: [
        { requuid: 'R-returned', subjectRef: 'D-tie', vesselId: 'V1', status: 'returned', submittedAt: '2026-09-16T08:00:00Z', finalizedAt: '2026-09-16T09:00:00Z' },
        { requuid: 'R-approved', subjectRef: 'D-tie', vesselId: 'V1', status: 'approved', submittedAt: '2026-09-16T08:30:00Z', finalizedAt: '2026-09-16T09:00:00Z' },
      ],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.returnedVerificationStillVerified).toHaveLength(1);
  });

  it('flags conservatively when a terminal request has no usable timestamp', async () => {
    mockDb({
      defects: [{ duuid: 'D-unknown-time', vesselId: 'V1', status: 'Closed', verified: true, isDeleted: false, targetDateExtensions: [] }],
      terminalRequests: [
        { requuid: 'R-returned', subjectRef: 'D-unknown-time', vesselId: 'V1', status: 'returned', submittedAt: null, finalizedAt: null },
        { requuid: 'R-approved', subjectRef: 'D-unknown-time', vesselId: 'V1', status: 'approved', submittedAt: '2026-09-16T10:00:00Z', finalizedAt: '2026-09-16T10:05:00Z' },
      ],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.returnedVerificationStillVerified).toHaveLength(1);
  });

  it('supplies a visible fallback when a vessel name cannot be resolved', async () => {
    mocks.resolveRoleApproverUserIds.mockResolvedValue([]);
    mockDb({
      workflows: [{ wfuuid: 'wf-1', screenId: 'defects-verification', classification: 'Normal' }],
      nodes: [{ workflowWfuuid: 'wf-1', nodeKey: 'step-1' }],
      slots: [{ workflowWfuuid: 'wf-1', nodeKey: 'step-1', roleId: 'role-1', roleLabel: '' }],
      roles: [],
      defects: [{ duuid: 'D-unknown-vessel', id: null, vesselId: 'missing-vessel-uuid', vesselName: null, status: 'Open', verified: false, isDeleted: false, targetDateExtensions: [] }],
    });
    const result = await getDefectApprovalDiagnostics();
    expect(result.unresolvedApprovers[0]).toMatchObject({
      vesselName: 'Unknown vessel (no longer in the vessel list)',
      roles: [{ roleId: 'role-1', roleName: 'Unknown role (removed from the role list)', issue: 'missing-workflow-role' }],
    });
  });
});
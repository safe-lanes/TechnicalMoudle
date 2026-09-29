import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sahil E6 (28-Sep-2026): only the sender may withdraw; the office settles it without the approver.
const gw = vi.hoisted(() => ({
  approvalRequestsInScopes: vi.fn(),
  withdrawEngineRequest: vi.fn(),
  isApprovalEngineAvailable: vi.fn(() => true),
  scopeFor: (moduleId: string, screenId: string) => ({ moduleId, screenId, actionId: '' }),
}));
const repo = vi.hoisted(() => ({
  insertWithdrawal: vi.fn(),
  setWithdrawalOutcome: vi.fn(),
  listOpenWithdrawals: vi.fn(),
  listWithdrawalsForSubject: vi.fn(),
}));
const cr = vi.hoisted(() => ({ changeRequestSender: vi.fn(), withdrawChangeRequest: vi.fn() }));
const wo = vi.hoisted(() => ({ postponementRequestSender: vi.fn(), withdrawPostponementRequest: vi.fn() }));
const df = vi.hoisted(() => ({ extensionEntrySender: vi.fn(), withdrawExtensionEntry: vi.fn() }));
const role = vi.hoisted(() => ({ isShipInstance: vi.fn() }));

vi.mock('../engineGateway', () => gw);
vi.mock('../approvalWithdrawalsRepository', () => repo);
vi.mock('../../change-requests/services/changeRequestsService', () => cr);
vi.mock('../../work-orders/services/workOrderService', () => wo);
vi.mock('../../defects/services/defectsService', () => df);
vi.mock('../../sync/syncRole', () => role);
const hist = vi.hoisted(() => ({ recordApprovalEvent: vi.fn(), currentActor: vi.fn(async () => ({ uuid: 'user-sender', name: 'CE', position: 'Chief Engineer' })) }));
vi.mock('../approvalHistoryService', () => hist);

import { processWithdrawal, requestWithdrawal } from '../approvalWithdrawalService';
import { AppError } from '../../shared/errors';

const SENDER = 'user-sender';
const row = (over: Record<string, unknown> = {}) => ({
  awuuid: 'aw-1', vesselId: 'V1', subjectType: 'change-request', subjectRef: 'cr-1', extensionId: null,
  reason: null, requestedByUuid: SENDER, requestedByName: 'Chief Engineer', requestedAt: new Date(), outcome: null,
  outcomeAt: null, outcomeNote: null, createdAt: new Date(), updatedAt: new Date(), createdByUuid: SENDER,
  updatedByUuid: SENDER, isDeleted: false, isSync: false, ...over,
});
const req = (requuid: string, status: string, submittedAt = '2026-09-28T10:00:00Z') => ({ requuid, status, submittedAt });

beforeEach(() => {
  vi.clearAllMocks();
  repo.setWithdrawalOutcome.mockImplementation(async (_id: string, outcome: string, note: string | null) => ({ ...row(), outcome, outcomeNote: note }));
  repo.listWithdrawalsForSubject.mockResolvedValue([]);
  repo.insertWithdrawal.mockImplementation(async (input: Record<string, unknown>) => ({ ...row(), ...input }));
  cr.changeRequestSender.mockResolvedValue({ id: 7, sender: SENDER, status: 'submitted', vesselId: 'V1', functionId: 'pms-spares-cr' });
  gw.approvalRequestsInScopes.mockResolvedValue([req('r1', 'pending')]);
  role.isShipInstance.mockResolvedValue(false);
  gw.withdrawEngineRequest.mockResolvedValue(undefined); // clearAllMocks keeps an earlier test's rejection
});

describe('processWithdrawal (office)', () => {
  it('pending request → engine request withdrawn, CR back to draft, outcome withdrawn', async () => {
    const out = await processWithdrawal(row());
    expect(gw.withdrawEngineRequest).toHaveBeenCalledWith('r1', SENDER, null);
    expect(cr.withdrawChangeRequest).toHaveBeenCalledWith(7);
    expect(out?.outcome).toBe('withdrawn');
    // 29-Sep-2026: the withdrawal is recorded in the CR's approval history under the sender.
    expect(hist.recordApprovalEvent).toHaveBeenCalledWith(expect.objectContaining({ subjectType: 'change-request', subjectRef: 'cr-1', eventType: 'withdrawn' }));
  });
  it('already decided in the module → too-late, nothing reset', async () => {
    cr.changeRequestSender.mockResolvedValue({ id: 7, sender: SENDER, status: 'approved', vesselId: 'V1', functionId: 'pms-spares-cr' });
    const out = await processWithdrawal(row());
    expect(out?.outcome).toBe('too-late');
    expect(gw.withdrawEngineRequest).not.toHaveBeenCalled();
    expect(cr.withdrawChangeRequest).not.toHaveBeenCalled();
  });
  it('engine already approved (record update behind) → too-late, the decision stands', async () => {
    gw.approvalRequestsInScopes.mockResolvedValue([req('r1', 'approved')]);
    const out = await processWithdrawal(row());
    expect(out?.outcome).toBe('too-late');
    expect(cr.withdrawChangeRequest).not.toHaveBeenCalled();
  });
  it('decided while being processed (engine 409) → too-late', async () => {
    gw.withdrawEngineRequest.mockRejectedValue(new AppError(409, 'already approved', { code: 'ALREADY_DECIDED' }));
    const out = await processWithdrawal(row());
    expect(out?.outcome).toBe('too-late');
    expect(cr.withdrawChangeRequest).not.toHaveBeenCalled();
  });
  it('no chain started yet → record reset only, outcome withdrawn', async () => {
    gw.approvalRequestsInScopes.mockResolvedValue([]);
    const out = await processWithdrawal(row());
    expect(gw.withdrawEngineRequest).not.toHaveBeenCalled();
    expect(cr.withdrawChangeRequest).toHaveBeenCalledWith(7);
    expect(out?.outcome).toBe('withdrawn');
  });
  it('WO approved before arrival (its waiting row — the sender record — is closed) → too-late, not refused', async () => {
    wo.postponementRequestSender.mockResolvedValue({ wouuid: 'wo-u', sender: null, status: 'Postponement Approved', vesselId: 'V1' });
    const out = await processWithdrawal(row({ subjectType: 'wo-postponement', subjectRef: 'wo-u' }));
    expect(out?.outcome).toBe('too-late');
  });
  it('not the sender → refused', async () => {
    const out = await processWithdrawal(row({ requestedByUuid: 'someone-else' }));
    expect(out?.outcome).toBe('refused');
    expect(gw.withdrawEngineRequest).not.toHaveBeenCalled();
  });
  it('WO postponement → reverted through the module with the sender as actor', async () => {
    wo.postponementRequestSender.mockResolvedValue({ wouuid: 'wo-u', sender: SENDER, status: 'Awaiting Office Approval', vesselId: 'V1' });
    const out = await processWithdrawal(row({ subjectType: 'wo-postponement', subjectRef: 'wo-u' }));
    expect(wo.withdrawPostponementRequest).toHaveBeenCalledWith('wo-u', { userUuid: SENDER, name: 'Chief Engineer' });
    expect(out?.outcome).toBe('withdrawn');
  });
  it('defect extension → entry withdrawn (target date untouched by this path)', async () => {
    df.extensionEntrySender.mockResolvedValue({ duuid: 'd-u', sender: SENDER, status: 'Requested', vesselId: 'V1' });
    const out = await processWithdrawal(row({ subjectType: 'defect-extension', subjectRef: 'd-u', extensionId: 'e1' }));
    expect(df.withdrawExtensionEntry).toHaveBeenCalledWith('d-u', 'e1');
    expect(out?.outcome).toBe('withdrawn');
  });
});

describe('requestWithdrawal (sender)', () => {
  const actor = { userUuid: SENDER, name: 'Chief Engineer' };
  it('someone else → 403', async () => {
    await expect(requestWithdrawal({ subjectType: 'change-request', subjectRef: 'cr-1' }, { userUuid: 'x', name: null }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(repo.insertWithdrawal).not.toHaveBeenCalled();
  });
  it('request sent before this change (no recorded sender) → 409 NO_SENDER', async () => {
    cr.changeRequestSender.mockResolvedValue({ id: 7, sender: null, status: 'submitted', vesselId: 'V1', functionId: 'pms-spares-cr' });
    await expect(requestWithdrawal({ subjectType: 'change-request', subjectRef: 'cr-1' }, actor))
      .rejects.toMatchObject({ statusCode: 409, details: { code: 'NO_SENDER' } });
  });
  it('a defect verification cannot be withdrawn → 400', async () => {
    await expect(requestWithdrawal({ subjectType: 'defect-verification', subjectRef: 'd-u' }, actor))
      .rejects.toMatchObject({ statusCode: 400 });
  });
  it('already asked → 409 ALREADY_ASKED', async () => {
    repo.listWithdrawalsForSubject.mockResolvedValue([row()]);
    await expect(requestWithdrawal({ subjectType: 'change-request', subjectRef: 'cr-1' }, actor))
      .rejects.toMatchObject({ statusCode: 409, details: { code: 'ALREADY_ASKED' } });
  });
  it('on a ship → recorded only; the office settles it after sync', async () => {
    role.isShipInstance.mockResolvedValue(true);
    const out = await requestWithdrawal({ subjectType: 'change-request', subjectRef: 'cr-1', reason: ' wrong spare ' }, actor);
    expect(out.outcome).toBeNull();
    expect(repo.insertWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ reason: 'wrong spare', requestedByUuid: SENDER, vesselId: 'V1' }));
    expect(gw.withdrawEngineRequest).not.toHaveBeenCalled();
  });
  it('on shore → settled at once', async () => {
    const out = await requestWithdrawal({ subjectType: 'change-request', subjectRef: 'cr-1' }, actor);
    expect(out.outcome).toBe('withdrawn');
    expect(gw.withdrawEngineRequest).toHaveBeenCalled();
  });
});

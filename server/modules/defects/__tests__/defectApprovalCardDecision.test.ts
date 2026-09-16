import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyExtensionDecision: vi.fn(),
  applyVerificationDecision: vi.fn(),
}));

vi.mock('../../../postgresClient', () => ({ getPostgresClient: vi.fn() }));
vi.mock('../../../utils/asyncLocalStorage', () => ({ getCurrentTenantContext: vi.fn() }));
vi.mock('../../approvals/approvalCard', () => ({ resolveRoleApproverUserIds: vi.fn() }));
vi.mock('../services/defectsApprovalHooks', () => ({
  applyExtensionDecision: mocks.applyExtensionDecision,
  applyVerificationDecision: mocks.applyVerificationDecision,
}));

import { defectsApprovalCard } from '../approvalCard';

describe('Defects approval card terminal decisions', () => {
  it.each(['defects-extension', 'defects-repeat-extension'])(
    'applies terminal extension decisions for %s',
    async (screenId) => {
      await defectsApprovalCard.onDecision({ tenantId: 'tenant' }, {
        requuid: 'request-1',
        scope: { moduleId: 'defects', screenId, actionId: '' },
        classification: 'Normal',
        subjectRef: 'defect-1',
        outcome: 'approved',
        decidedBy: 'user-1',
        remarks: 'approved',
      });
      expect(mocks.applyExtensionDecision).toHaveBeenCalledWith(
        'defect-1', true, 'approved', 'user-1',
      );
    },
  );

  it('passes the committed request UUID to verification return handling', async () => {
    await defectsApprovalCard.onDecision({ tenantId: 'tenant' }, {
      requuid: 'request-returned-1',
      scope: { moduleId: 'defects', screenId: 'defects-verification', actionId: '' },
      classification: 'Normal',
      subjectRef: 'defect-1',
      outcome: 'returned',
      decidedBy: 'user-1',
      remarks: 'Closeout evidence is incomplete',
    });

    expect(mocks.applyVerificationDecision).toHaveBeenCalledWith(
      'defect-1', false, 'Closeout evidence is incomplete', 'user-1', 'request-returned-1',
    );
  });
});
import { describe, expect, it } from 'vitest';
import {
  approvalDecisionApplyError,
  resolveDefectApprovalPresentation,
  resolveVerificationDisplay,
} from '../../../../client/src/pages/defects/defectApprovalPresentation';

describe('Defect approval presentation states', () => {
  it.each(['extension', 'verification'] as const)(
    'keeps the %s endpoint error visible, retryable, and non-actionable',
    (_action) => {
      const result = resolveDefectApprovalPresentation({
        isLoading: false,
        error: new Error('endpoint failed'),
        data: undefined,
      }, true);

      expect(result).toEqual({
        state: 'error',
        message: 'Could not load approval status. Retry.',
        showDecisionControls: false,
      });
    },
  );

  it('keeps a non-503 failure retryable even if it carries the instance-unavailable code', () => {
    expect(resolveDefectApprovalPresentation({
      isLoading: false,
      error: {
        code: 'APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE',
        status: 500,
      },
      data: undefined,
    }, true)).toEqual({
      state: 'error',
      message: 'Could not load approval status. Retry.',
      showDecisionControls: false,
    });
  });

  it.each(['extension', 'verification'] as const)(
    'renders calm, non-retryable ship guidance for %s',
    (_action) => {
      const result = resolveDefectApprovalPresentation({
        isLoading: false,
        error: {
          code: 'APPROVAL_ENGINE_UNAVAILABLE_ON_INSTANCE',
          status: 503,
        },
        data: undefined,
      }, true);

      expect(result).toEqual({
        state: 'ship-unavailable',
        message: 'Approval is handled ashore. This request will be reviewed after the next sync.',
        showDecisionControls: false,
      });
      expect(result).not.toHaveProperty('retry');
    },
  );

  it('does not call an unsaved defect a missing workflow', () => {
    expect(resolveDefectApprovalPresentation({
      isLoading: false,
      error: null,
      data: undefined,
    }, true)).toEqual({
      state: 'idle',
      showDecisionControls: false,
    });
  });

  it('hides loaded decision controls in view mode', () => {
    expect(resolveDefectApprovalPresentation({
      isLoading: false,
      error: null,
      data: {
        hasActiveWorkflow: true,
        requestStatus: 'pending',
        requestUuid: 'request-1',
        currentUserCanDecide: true,
        steps: [],
      },
    }, false)).toEqual({
      state: 'loaded',
      showDecisionControls: false,
    });
  });

  it.each(['pending', 'returned', 'rejected'])(
    'does not present verification attribution for a %s request',
    (requestStatus) => {
      expect(resolveVerificationDisplay({ requestUuid: 'request-1', requestStatus }, {
        verified: true,
        dateVerified: '2026-09-14',
        verifiedByName: 'Intermediate Approver',
        verifiedByOfficePosition: 'Superintendent',
      })).toEqual({ date: '', name: '', position: '' });
    },
  );

  it.each(['loading', 'error', 'idle'])(
    'keeps verification attribution blank while approval status is %s',
    (_state) => {
      expect(resolveVerificationDisplay(undefined, {
        verified: true,
        dateVerified: '2026-09-14',
        verifiedByName: 'Legacy Verifier',
        verifiedByOfficePosition: 'Superintendent',
      })).toEqual({ date: '', name: '', position: '' });
    },
  );

  it('presents authoritative defect verification fields after terminal approval', () => {
    expect(resolveVerificationDisplay({ requestUuid: 'request-1', requestStatus: 'approved' }, {
      verified: true,
      dateVerified: '2026-09-14',
      verifiedByName: 'Final Approver',
      verifiedByOfficePosition: 'Fleet Manager',
    })).toEqual({
      date: '2026-09-14',
      name: 'Final Approver',
      position: 'Fleet Manager',
      isLegacyVerification: false,
    });
  });

  it('presents stored verification as legacy after confirming no engine request exists', () => {
    expect(resolveVerificationDisplay({ requestUuid: null, requestStatus: null }, {
      verified: true,
      dateVerified: '2025-03-12',
      verifiedByName: 'Legacy Verifier',
      verifiedByOfficePosition: 'Technical Manager',
    })).toEqual({
      date: '2025-03-12',
      name: 'Legacy Verifier',
      position: 'Technical Manager',
      isLegacyVerification: true,
    });
  });

  it('surfaces terminal callback application failures', () => {
    expect(approvalDecisionApplyError({ callbackError: 'Defect update failed' }))
      .toBe('Defect update failed');
    expect(approvalDecisionApplyError({ requestStatus: 'approved' })).toBeNull();
  });
});
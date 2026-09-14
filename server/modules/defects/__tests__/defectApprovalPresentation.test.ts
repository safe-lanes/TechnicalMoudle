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
      expect(resolveVerificationDisplay(requestStatus, {
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
        dateVerified: '2026-09-14',
        verifiedByName: 'Legacy Verifier',
        verifiedByOfficePosition: 'Superintendent',
      })).toEqual({ date: '', name: '', position: '' });
    },
  );

  it('presents authoritative defect verification fields after terminal approval', () => {
    expect(resolveVerificationDisplay('approved', {
      dateVerified: '2026-09-14',
      verifiedByName: 'Final Approver',
      verifiedByOfficePosition: 'Fleet Manager',
    })).toEqual({
      date: '2026-09-14',
      name: 'Final Approver',
      position: 'Fleet Manager',
    });
  });

  it('surfaces terminal callback application failures', () => {
    expect(approvalDecisionApplyError({ callbackError: 'Defect update failed' }))
      .toBe('Defect update failed');
    expect(approvalDecisionApplyError({ requestStatus: 'approved' })).toBeNull();
  });
});
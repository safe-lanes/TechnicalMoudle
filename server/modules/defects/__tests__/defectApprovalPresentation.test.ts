import { describe, expect, it } from 'vitest';
import {
  approvalDecisionApplyError,
  approvalPreviewMessage,
  isC1CloseoutComplete,
  resolveDefectApprovalPresentation,
  resolveDefectExtensionUi,
  resolveEffectiveExtensionRequestStatus,
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

  it.each([
    {
      name: 'no request',
      input: { formOpen: false, hasStoredExtension: false, canEdit: true },
      state: 'no-request',
      showContainer: false,
      fieldsReadOnly: true,
      showSubmit: false,
    },
    {
      name: 'unsaved preview',
      input: { formOpen: true, hasStoredExtension: false, canEdit: true },
      state: 'draft-preview',
      showContainer: true,
      fieldsReadOnly: false,
      showSubmit: true,
    },
    {
      name: 'requester pending',
      input: { formOpen: false, hasStoredExtension: true, requestStatus: 'pending', currentUserCanDecide: false, canEdit: true },
      state: 'requester-pending',
      showContainer: true,
      fieldsReadOnly: true,
      showSubmit: false,
    },
    {
      name: 'approver pending',
      input: { formOpen: false, hasStoredExtension: true, requestStatus: 'pending', currentUserCanDecide: true, canEdit: true },
      state: 'approver-pending',
      showContainer: true,
      fieldsReadOnly: true,
      showSubmit: false,
    },
    {
      name: 'approved',
      input: { formOpen: false, hasStoredExtension: true, requestStatus: 'approved', currentUserCanDecide: false, canEdit: true },
      state: 'approved',
      showContainer: true,
      fieldsReadOnly: true,
      showSubmit: false,
    },
    {
      name: 'repeat draft after approval',
      input: { formOpen: true, hasStoredExtension: true, requestStatus: 'approved', currentUserCanDecide: false, canEdit: true },
      state: 'draft-preview',
      showContainer: true,
      fieldsReadOnly: false,
      showSubmit: true,
    },
    {
      name: 'rejected',
      input: { formOpen: false, hasStoredExtension: true, requestStatus: 'returned', currentUserCanDecide: false, canEdit: true },
      state: 'rejected',
      showContainer: true,
      fieldsReadOnly: true,
      showSubmit: false,
    },
  ])('resolves the B5 $name state', ({ input, name: _name, ...expected }) => {
    expect(resolveDefectExtensionUi(input)).toEqual(expected);
  });

  it('does not call a B5 preview a progress chain and names its ordered roles', () => {
    const message = approvalPreviewMessage({
      scope: 'defect-extension',
      classification: 'Normal',
      activeWorkflowExists: true,
      fellBackFromRepeatScope: false,
    }, [
      { label: 'First', roles: ['User'] },
      { label: 'Second', roles: ['Admin'] },
    ]);
    expect(message).toBe('This request will require 2 approvals: Step 1 - User, Step 2 - Admin.');
    expect(message).not.toContain('progress');
    expect(message).not.toContain('pending');
  });

  it('explains Critical date-threshold escalation', () => {
    expect(approvalPreviewMessage({
      scope: 'defect-extension',
      classification: 'Critical Equipment / COC Related',
      activeWorkflowExists: true,
      fellBackFromRepeatScope: false,
      factors: { exceedsThreshold: true, longExtensionThreshold: 90, extensionDays: 91 },
    }, [
      { label: 'First', roles: ['User'] },
      { label: 'Second', roles: ['Admin'] },
    ])).toBe('This extension exceeds 90 days and will require 2 approvals: Step 1 - User, Step 2 - Admin.');
  });

  it('uses the effective repeat-fallback workflow without requester-facing fallback wording', () => {
    const message = approvalPreviewMessage({
      scope: 'defect-extension',
      classification: 'Normal',
      activeWorkflowExists: true,
      fellBackFromRepeatScope: true,
    }, [{ label: 'Initial extension approval', roles: ['Superintendent'] }]);
    expect(message).toContain('Step 1 - Superintendent');
    expect(message.toLowerCase()).not.toContain('fallback');
    expect(message.toLowerCase()).not.toContain('repeat');
  });

  it('does not guess a preview count when no active workflow exists', () => {
    const message = approvalPreviewMessage({
      scope: 'defect-extension',
      classification: 'Normal',
      activeWorkflowExists: false,
      fellBackFromRepeatScope: false,
    }, []);
    expect(message).toBe('No approval workflow is configured for Normal. Contact your administrator.');
    expect(message).not.toMatch(/\d+ approval/);
  });

  it.each([
    [{ confirmCompleted: false, dateCompleted: '2026-09-16', closedByName: 'Master', closedByRank: 'Master' }, false],
    [{ confirmCompleted: true, dateCompleted: '', closedByName: 'Master', closedByRank: 'Master' }, false],
    [{ confirmCompleted: true, dateCompleted: '2026-09-16', closedByName: 'Master', closedByRank: 'Master' }, true],
  ] as const)('gates the C2 preview on complete C1 values', (values, expected) => {
    expect(isC1CloseoutComplete(values)).toBe(expected);
  });

  it.each([
    ['Requested', undefined, 'pending'],
    ['Requested', 'pending', 'pending'],
    ['Requested', 'approved', 'approved'],
    ['Requested', 'returned', 'returned'],
    ['Approved', 'approved', 'approved'],
  ])('lets terminal chain state override stale local extension state', (local, chain, expected) => {
    expect(resolveEffectiveExtensionRequestStatus(local, chain)).toBe(expected);
  });
});
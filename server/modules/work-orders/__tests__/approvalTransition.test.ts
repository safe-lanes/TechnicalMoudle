import { describe, expect, it } from 'vitest';
import { classifyApprovalTransition } from '../utils/approvalTransition';

describe('Work Order approval transition classification', () => {
  it('recognizes only an explicit Pending Approval to Completed approval', () => {
    expect(classifyApprovalTransition({
      existingStatus: 'Pending Approval',
      requestedStatus: 'Completed',
      approvalAction: 'approved',
    })).toEqual({
      pendingToCompleted: true,
      explicitApproval: true,
      explicitRejection: false,
      missingExplicitApproval: false,
      invalidActionStatus: false,
    });
  });

  it('rejects status-only completion as a genuine approval', () => {
    expect(classifyApprovalTransition({
      existingStatus: 'Pending Approval',
      requestedStatus: 'Completed',
      approvalAction: undefined,
    })).toMatchObject({
      pendingToCompleted: true,
      explicitApproval: false,
      missingExplicitApproval: true,
    });
  });

  it('recognizes an explicit rejection before persistence normalizes its status to Due', () => {
    expect(classifyApprovalTransition({
      existingStatus: 'Pending Approval',
      requestedStatus: 'Rejected',
      approvalAction: 'rejected',
    })).toMatchObject({
      explicitApproval: false,
      explicitRejection: true,
      invalidActionStatus: false,
    });
  });

  it.each([
    ['draft save', 'Due', 'Due', undefined],
    ['submission', 'Due', 'Pending Approval', 'submitted'],
    ['rejection', 'Pending Approval', 'Rejected', 'rejected'],
    ['Part-B edit', 'Pending Approval', 'Pending Approval', undefined],
  ])('does not classify %s as approval', (_label, existingStatus, requestedStatus, approvalAction) => {
    expect(classifyApprovalTransition({ existingStatus, requestedStatus, approvalAction }))
      .toMatchObject({ explicitApproval: false, missingExplicitApproval: false });
  });

  it.each([
    ['approved without completion', 'Pending Approval', 'Pending Approval', 'approved'],
    ['rejected without rejected status', 'Pending Approval', 'Pending Approval', 'rejected'],
    ['unknown action', 'Pending Approval', 'Pending Approval', 'force'],
  ])('marks %s as an invalid action/status combination', (_label, existingStatus, requestedStatus, approvalAction) => {
    expect(classifyApprovalTransition({ existingStatus, requestedStatus, approvalAction }))
      .toMatchObject({ invalidActionStatus: true, explicitApproval: false });
  });
});
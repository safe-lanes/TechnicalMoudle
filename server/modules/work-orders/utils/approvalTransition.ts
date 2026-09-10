export function classifyApprovalTransition(input: {
  existingStatus: string | null | undefined;
  requestedStatus: string | null | undefined;
  approvalAction: string | null | undefined;
}) {
  const pendingToCompleted =
    input.existingStatus === 'Pending Approval' &&
    input.requestedStatus === 'Completed';
  const explicitApproval = pendingToCompleted && input.approvalAction === 'approved';
  const explicitRejection =
    input.existingStatus === 'Pending Approval' &&
    input.requestedStatus === 'Rejected' &&
    input.approvalAction === 'rejected';
  const recognizedActionStatus =
    input.approvalAction == null ||
    (input.approvalAction === 'approved' && input.requestedStatus === 'Completed') ||
    (input.approvalAction === 'rejected' && input.requestedStatus === 'Rejected') ||
    ((input.approvalAction === 'submitted' || input.approvalAction === 'submit') &&
      input.requestedStatus === 'Pending Approval');

  return {
    pendingToCompleted,
    explicitApproval,
    explicitRejection,
    missingExplicitApproval: pendingToCompleted && !explicitApproval,
    invalidActionStatus: !recognizedActionStatus,
  };
}
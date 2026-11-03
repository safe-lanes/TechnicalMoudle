import type { DefectPdfApprovalHistory } from '@/pages/defects/defectPdfApprovalHistory';

export const recordedHistory: DefectPdfApprovalHistory = {
  extension: {
    subjectType: 'defect-extension',
    attempts: [
      { number: 1, events: [
        { type: 'submitted', label: 'Requested', byName: 'Extension Submitter', byPosition: 'Master', at: '2026-11-03T08:00:00Z', remarks: 'Original reason' },
        { type: 'rejected', label: 'Rejected - Step 1', byName: 'First Reviewer', byPosition: 'Superintendent', at: '2026-11-03T08:30:00Z', remarks: 'Reason for first rejection' },
      ] },
      { number: 2, events: [
        { type: 'submitted', label: 'Requested again', byName: 'Second Submitter', byPosition: 'Master', at: '2026-11-03T09:00:00Z', remarks: 'Revised reason' },
        { type: 'approved', label: 'Approved - Step 1', byName: 'Intermediate Approver', byPosition: 'Superintendent', at: '2026-11-03T09:15:00Z', remarks: 'First level passed' },
        { type: 'approved', label: 'Approved - Step 2', byName: 'Final Approver', byPosition: 'Marine Manager', at: '2026-11-03T09:30:00Z', remarks: 'ADMIN OVERRIDE\nRecorded override explanation' },
      ] },
      { number: 3, events: [
        { type: 'withdrawn', label: 'Withdrawn', byName: 'Withdrawal Actor', byPosition: 'Master', at: '2026-11-03T10:00:00Z', remarks: 'No longer required' },
      ] },
    ],
  },
  verification: {
    subjectType: 'defect-verification',
    attempts: [
      { number: 1, events: [
        { type: 'submitted', label: 'Closed out - sent for verification', byName: 'Closure Submitter', byPosition: 'Master', at: '2026-11-03T10:30:00Z', remarks: 'Original evidence' },
        { type: 'rejected', label: 'Rejected - Step 1', byName: 'Closure Reviewer', byPosition: 'Marine Manager', at: '2026-11-03T11:00:00Z', remarks: 'Additional closure evidence required' },
      ] },
      { number: 2, events: [
        { type: 'submitted', label: 'Closed out again', byName: 'Closure Resubmitter', byPosition: 'Master', at: '2026-11-03T11:30:00Z', remarks: 'Corrected evidence' },
        { type: 'approved', label: 'Approved - Step 1', byName: 'Verification Approver', byPosition: 'Marine Manager', at: '2026-11-03T12:00:00Z', remarks: 'Verification accepted' },
      ] },
    ],
  },
};

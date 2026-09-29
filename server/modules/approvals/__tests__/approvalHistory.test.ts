import { describe, expect, it, vi } from 'vitest';

vi.mock('../approvalHistoryRepository', () => ({}));
vi.mock('../../work-orders/repositories/workOrderRepository', () => ({}));

import { buildApprovalProcess } from '../approvalHistoryService';
import { woCompletionEventsForUpdate } from '../../work-orders/services/woApprovalHistory';

// 29-Sep-2026 (Jeevan): approval process — every attempt, name + position + time, "Not Recorded" for older records.
const row = (eventType: string, at: string, name: string | null = 'Jeevan Naik', position: string | null = 'Chief Engineer', extra: Record<string, unknown> = {}) =>
  ({ eventType, occurredAt: new Date(at), actorName: name, actorPosition: position, remarks: null, stepLabel: null, ...extra });

describe('buildApprovalProcess', () => {
  it('a new attempt starts at every submission; rejected attempts are kept', () => {
    const p = buildApprovalProcess('wo-completion', [
      row('submitted', '2026-09-29T08:00:00Z'), row('rejected', '2026-09-29T09:00:00Z', 'A', 'Chief Engineer', { remarks: 'redo' }),
      row('submitted', '2026-09-29T10:00:00Z'), row('approved', '2026-09-29T11:00:00Z'), row('ts-acknowledged', '2026-09-29T12:00:00Z', 'T', 'Technical Superintendent'),
    ]);
    expect(p.attempts.map((a) => a.events.map((e) => e.label))).toEqual([
      ['Submitted', 'Rejected'],
      ['Resubmitted', 'Approved', 'Acknowledged by Technical Superintendent'],
    ]);
    expect(p.attempts[0].events[1].remarks).toBe('redo');
  });
  it('postponements say Requested / Requested again; step names shown', () => {
    const p = buildApprovalProcess('wo-postponement', [
      row('submitted', '2026-09-29T08:00:00Z'), row('rejected', '2026-09-29T09:00:00Z', 'O', 'Office', { stepLabel: 'Office sign-off' }),
      row('submitted', '2026-09-29T10:00:00Z'),
    ]);
    expect(p.attempts.map((a) => a.events.map((e) => e.label))).toEqual([['Requested', 'Rejected — Office sign-off'], ['Requested again']]);
  });
  it('older records only: their events are shown with whatever was captured', () => {
    const p = buildApprovalProcess('wo-completion', [], [{ type: 'submitted', at: '2026-09-01T08:00:00Z' }, { type: 'approved', at: null, byPosition: 'Chief Engineer' }]);
    expect(p.attempts).toHaveLength(1);
    expect(p.attempts[0].events[0]).toMatchObject({ label: 'Submitted', byName: null, at: '2026-09-01T08:00:00Z' });
    expect(p.attempts[0].events[1]).toMatchObject({ label: 'Approved', byName: null, byPosition: 'Chief Engineer', at: null });
  });
  it('an older submission before the first recorded event is kept; the same decision is never shown twice', () => {
    const p = buildApprovalProcess('wo-postponement',
      [row('approved', '2026-09-29T11:00:00Z')],
      [{ type: 'submitted', at: '2026-09-20' }, { type: 'approved', at: '2026-09-29' }]);
    expect(p.attempts[0].events.map((e) => e.label)).toEqual(['Requested', 'Approved']);
    expect(p.attempts[0].events[1].byName).toBe('Jeevan Naik');
  });
  it('no activity → no attempts', () => {
    expect(buildApprovalProcess('change-request', []).attempts).toEqual([]);
  });
});

describe('woCompletionEventsForUpdate', () => {
  const none = { rejected: false, forwardedForOfficeReview: false };
  it('submit → submitted', () => {
    expect(woCompletionEventsForUpdate({ status: 'Due' }, { status: 'Pending Approval' }, none).map((e) => e.eventType)).toEqual(['submitted']);
  });
  it('HOD approve → approved (with remarks)', () => {
    const out = woCompletionEventsForUpdate({ status: 'Pending Approval' }, { status: 'Completed' }, none, { approval: 'ok' });
    expect(out).toEqual([{ eventType: 'approved', remarks: 'ok', stepLabel: null }]);
  });
  it('reject → only rejected', () => {
    expect(woCompletionEventsForUpdate({ status: 'Pending Approval' }, { status: 'Due' }, { rejected: true, forwardedForOfficeReview: false }, { rejection: 'no' }))
      .toEqual([{ eventType: 'rejected', remarks: 'no', stepLabel: null }]);
  });
  it('sent for Level 2 office review → forwarded', () => {
    expect(woCompletionEventsForUpdate({ status: 'Pending Approval' }, { status: 'Pending Office Review' }, { rejected: false, forwardedForOfficeReview: true }).map((e) => e.eventType)).toEqual(['forwarded']);
  });
  it('Tech. Sup. acknowledgement recorded once', () => {
    expect(woCompletionEventsForUpdate({ status: 'Pending Approval', superintendentAcknowledged: false }, { status: 'Pending Approval', superintendentAcknowledged: true }, none).map((e) => e.eventType)).toEqual(['ts-acknowledged']);
    expect(woCompletionEventsForUpdate({ status: 'Pending Approval', superintendentAcknowledged: true }, { status: 'Pending Approval', superintendentAcknowledged: true }, none)).toEqual([]);
  });
  it('an ordinary save records nothing', () => {
    expect(woCompletionEventsForUpdate({ status: 'Due' }, { status: 'Due' }, none)).toEqual([]);
  });
  it('completed without an approval step → completed', () => {
    expect(woCompletionEventsForUpdate({ status: 'Due' }, { status: 'Completed' }, none).map((e) => e.eventType)).toEqual(['completed']);
  });
});

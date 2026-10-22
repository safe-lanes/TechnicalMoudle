import { describe, expect, it, vi } from 'vitest';

// Jeevan #9 (22-Oct-2026): Defects use the shared approval history.
const recordApprovalEvent = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../approvalHistoryService', async (orig) => ({ ...(await orig<any>()), recordApprovalEvent }));

import { recordDefectStepFromEvent } from '../engineGateway';
import { buildApprovalProcess } from '../approvalHistoryService';

const evt = (screenId: string, moduleId = 'defects') => ({
  type: 'slot-decided' as const, tenantId: 'default', requuid: 'r1', scope: { moduleId, screenId, actionId: '' },
  subjectRef: 'duuid-1', vesselId: 'V1', nodeKey: 'n1', nodeLabel: 'Superintendent', decision: 'approve' as const,
  decidedBy: 'u1', remarks: 'fine', adminOverride: false,
});

describe('defect step decisions → approval history', () => {
  it('extension (normal + repeat) and verification steps are recorded; technical scopes are not (gateway does those)', () => {
    recordDefectStepFromEvent(evt('defects-extension'));
    recordDefectStepFromEvent(evt('defects-repeat-extension'));
    recordDefectStepFromEvent(evt('defects-verification'));
    recordDefectStepFromEvent(evt('pms-spares-cr', 'technical'));
    expect(recordApprovalEvent.mock.calls.map((c: any[]) => c[0].subjectType)).toEqual(['defect-extension', 'defect-extension', 'defect-verification']);
    expect(recordApprovalEvent.mock.calls[0][0]).toMatchObject({ vesselId: 'V1', subjectRef: 'duuid-1', eventType: 'approved', stepLabel: 'Superintendent', remarks: 'fine' });
  });
  it('labels', () => {
    const row = (eventType: string) => ({ eventType, occurredAt: new Date('2026-10-22T10:00:00Z'), actorName: 'A', actorPosition: 'Master', remarks: null, stepLabel: null });
    expect(buildApprovalProcess('defect-extension', [row('submitted') as any]).attempts[0].events[0].label).toBe('Requested');
    expect(buildApprovalProcess('defect-verification', [row('submitted') as any]).attempts[0].events[0].label).toBe('Closed out — sent for verification');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('../engineGateway', () => ({}));
vi.mock('../approvalCard', () => ({}));
vi.mock('../stalledApprovalWarning', () => ({}));
vi.mock('../approvalNotifier', () => ({}));
vi.mock('../approvalDiagnosticsRepository', () => ({}));
vi.mock('../../change-requests/services/changeRequestsService', () => ({}));

import { isFailedUpdate } from '../approvalDiagnosticsService';

// Sahil C5 (28-Sep-2026): a finished request whose record never updated is a "failed update".
const now = new Date('2026-09-28T12:00:00Z');
const scope = { moduleId: 'technical', screenId: 'pms-spares-cr', actionId: '' };
const req = (requuid: string, status: string, submittedAt: string, finalizedAt: string | null) =>
  ({ requuid, status, submittedAt, finalizedAt, scope });

describe('isFailedUpdate', () => {
  it('newest request finished more than 2 minutes ago → failed update', () => {
    expect(isFailedUpdate([req('r1', 'approved', '2026-09-28T10:00:00Z', '2026-09-28T11:00:00Z')], now)?.requuid).toBe('r1');
  });
  it('finished just now → normal hand-over, not reported', () => {
    expect(isFailedUpdate([req('r1', 'approved', '2026-09-28T11:59:00Z', '2026-09-28T11:59:30Z')], now)).toBeNull();
  });
  it('newest request still pending → not a failed update (older finished ones ignored)', () => {
    expect(isFailedUpdate([
      req('old', 'returned', '2026-09-20T10:00:00Z', '2026-09-20T11:00:00Z'),
      req('new', 'pending', '2026-09-27T10:00:00Z', null),
    ], now)).toBeNull();
  });
  it('returned (rejected) also counts', () => {
    expect(isFailedUpdate([req('r2', 'returned', '2026-09-28T09:00:00Z', '2026-09-28T09:30:00Z')], now)?.requuid).toBe('r2');
  });
  it('no requests → nothing', () => {
    expect(isFailedUpdate([], now)).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';

// QA round 2 (WD-01..06): the change-request sender for Withdraw is the actor of the LATEST 'submitted' event.
const listEvents = vi.hoisted(() => vi.fn());
vi.mock('../approvalHistoryRepository', () => ({ listEvents }));

import { latestSubmitterUuid } from '../approvalHistoryService';

const ev = (eventType: string, actorUuid: string | null) => ({ eventType, actorUuid });

describe('latestSubmitterUuid', () => {
  it('returns the actor of the most recent submission (a resubmission by someone else wins)', async () => {
    listEvents.mockResolvedValue([ev('submitted', 'u-first'), ev('returned', 'u-approver'), ev('submitted', 'u-second'), ev('approved', 'u-approver')]);
    await expect(latestSubmitterUuid('change-request', 'cr-1')).resolves.toBe('u-second');
    expect(listEvents).toHaveBeenCalledWith('cr-1', ['change-request']);
  });
  it('is null when no submission was recorded (requests from before the history existed)', async () => {
    listEvents.mockResolvedValue([ev('approved', 'u-approver')]);
    await expect(latestSubmitterUuid('change-request', 'cr-2')).resolves.toBeNull();
    listEvents.mockResolvedValue([]);
    await expect(latestSubmitterUuid('change-request', 'cr-3')).resolves.toBeNull();
  });
});

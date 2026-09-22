import { describe, expect, it } from 'vitest';
import { enrichWorkOrderUpdateWithActor } from '../utils/updateActorIdentity';

describe('generic Work Order PATCH actor enrichment', () => {
  it.each([
    ['approval', { status: 'Completed', approvalAction: 'approved' }],
    ['rejection', { status: 'Rejected', approvalAction: 'rejected' }],
  ])('adds audit identity without manufacturing performedBy for %s', (_label, payload) => {
    const enriched = enrichWorkOrderUpdateWithActor(
      { ...payload },
      'Chief Engineer',
    );

    expect(enriched.userId).toBe('Chief Engineer');
    expect(enriched).not.toHaveProperty('performedBy');
  });

  it('preserves an explicitly supplied performer', () => {
    const enriched = enrichWorkOrderUpdateWithActor(
      { performedBy: 'Third Engineer' },
      'Chief Engineer',
    );

    expect(enriched).toMatchObject({
      userId: 'Chief Engineer',
      performedBy: 'Third Engineer',
    });
  });

  it('replaces a system audit identity without treating system performer as actor metadata', () => {
    const enriched = enrichWorkOrderUpdateWithActor(
      { userId: 'system', performedBy: 'system' },
      'Chief Engineer',
    );

    expect(enriched).toEqual({
      userId: 'Chief Engineer',
      performedBy: 'system',
    });
  });
});
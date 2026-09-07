import { describe, expect, it } from 'vitest';
import {
  SERVER_MANAGED_WORK_ORDER_RH_FIELDS,
  stripServerManagedWorkOrderRhFields,
} from '@shared/workOrderPayload';

describe('stripServerManagedWorkOrderRhFields', () => {
  it('removes every server-managed RH field while preserving editable completion data', () => {
    const input = {
      currentReading: '700',
      currentReadingDate: '2026-04-20',
      workCarriedOut: 'Completed planned maintenance safely.',
      consumedSpareParts: [{ partNo: '4451-2566-001', quantityConsumed: '1' }],
      rhSyncedAt: '2026-04-20T10:00:00.000Z',
      rhUpdateOutcome: 'skipped_lower',
      rhSkipReason: 'LOWER_THAN_LIVE_RH',
      rhSkipSubmittedRh: '600',
      rhSkipLatestRh: '700',
      rhSkipLatestRhDate: '2026-04-20',
    };

    const result = stripServerManagedWorkOrderRhFields(input);

    expect(result).toMatchObject({
      currentReading: '700',
      currentReadingDate: '2026-04-20',
      workCarriedOut: 'Completed planned maintenance safely.',
      consumedSpareParts: input.consumedSpareParts,
    });
    for (const field of SERVER_MANAGED_WORK_ORDER_RH_FIELDS) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('does not mutate context-backed form state', () => {
    const input = {
      currentReading: '700',
      rhUpdateOutcome: 'skipped_lower',
      rhSkipLatestRh: '725',
    };

    stripServerManagedWorkOrderRhFields(input);

    expect(input).toEqual({
      currentReading: '700',
      rhUpdateOutcome: 'skipped_lower',
      rhSkipLatestRh: '725',
    });
  });
});
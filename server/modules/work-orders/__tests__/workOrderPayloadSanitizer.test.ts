import { describe, expect, it } from 'vitest';
import {
  SERVER_MANAGED_WORK_ORDER_RH_FIELDS,
  WORK_ORDER_B3_FIELDS,
  isWorkOrderB3Applicable,
  sanitizeWorkOrderB3Fields,
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

describe('Work Order B3 applicability', () => {
  it.each([
    ['MASTER', true],
    ['master', true],
    ['INHERITED', true],
    ['NOT_RH_DRIVEN', false],
    ['', false],
    [undefined, false],
  ])('maps counter type %s to applicability %s', (counterType, expected) => {
    expect(isWorkOrderB3Applicable(counterType)).toBe(expected);
  });

  it('removes every B3 field for a Not Driven component without removing Completion RH', () => {
    const input = {
      runningHours: '700',
      previousReading: '650',
      runningHoursDifference: '50',
      readingDate: '2026-04-20',
      currentReadingDate: '2026-04-20',
      currentReading: '700',
      woCompletionRh: '675',
      workCarriedOut: 'Completed planned maintenance safely.',
    };

    const result = sanitizeWorkOrderB3Fields(input, 'NOT_RH_DRIVEN');

    for (const field of WORK_ORDER_B3_FIELDS) {
      expect(result).not.toHaveProperty(field);
    }
    expect(result).toMatchObject({
      woCompletionRh: '675',
      workCarriedOut: input.workCarriedOut,
    });
    expect(input).toHaveProperty('currentReading', '700');
  });

  it.each(['MASTER', 'INHERITED'])(
    'keeps applicable B3 values but removes Previous Reading for %s',
    (counterType) => {
      const result = sanitizeWorkOrderB3Fields({
        currentReading: '700',
        currentReadingDate: '2026-04-20',
        previousReading: '650',
      }, counterType);

      expect(result).toEqual({
        currentReading: '700',
        currentReadingDate: '2026-04-20',
      });
    },
  );
});
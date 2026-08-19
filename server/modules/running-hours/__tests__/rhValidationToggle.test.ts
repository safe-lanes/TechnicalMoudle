import { describe, expect, it } from 'vitest';
import { cascadeRunningHoursSchema } from '@shared/schema';
import { cascadeUpdate } from '../services/runningHoursService';

const baseRequest = {
  parentComponentId: 'test-component',
  dateUpdated: '2026-08-19',
  userId: 'test-user',
};

describe('Running Hours validation toggle contract', () => {
  it('keeps the existing Add Delta positive-value rule when validation is on', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'addDelta',
      value: 0,
    });

    expect(result.success).toBe(false);
  });

  it('allows a negative Add Delta value only when validation is requested off', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'addDelta',
      value: -25,
      rhValidationEnabled: false,
    });

    expect(result.success).toBe(true);
  });

  it('keeps Set Total readings non-negative regardless of toggle state', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'setTotal',
      value: -1,
      rhValidationEnabled: false,
    });

    expect(result.success).toBe(false);
  });

  it('allows a normal zero reset request when validation is requested off', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'setTotal',
      value: 0,
      meterReplaced: false,
      rhValidationEnabled: false,
    });

    expect(result.success).toBe(true);
  });

  it('keeps Meter Replaced Old Meter Final validation mandatory while validation is off', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'setTotal',
      value: 0,
      meterReplaced: true,
      rhValidationEnabled: false,
      isRenewalReset: true,
      renewalActionType: 'Replaced',
      renewalReason: 'Physical meter replacement',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some(issue => issue.path.includes('oldMeterFinal'))).toBe(true);
  });

  it('keeps Meter Replaced Add Delta positive even while validation is off', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'addDelta',
      value: -25,
      meterReplaced: true,
      oldMeterFinal: '1000',
      rhValidationEnabled: false,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some(issue => issue.path.includes('value'))).toBe(true);
  });

  it('rejects a direct validation-off request from a non-Sail Admin before touching data', async () => {
    await expect(cascadeUpdate({
      ...baseRequest,
      mode: 'addDelta',
      value: -25,
      rhValidationEnabled: false,
    }, 'PMS Admin')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only Sail Admin users can turn off Running Hours validation.',
    });
  });
});
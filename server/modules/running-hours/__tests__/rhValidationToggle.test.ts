import { describe, expect, it } from 'vitest';
import { cascadeRunningHoursSchema } from '@shared/schema';
import { isRhValidationEnabledForVessel, validateCascadePolicyRules } from '../services/runningHoursService';

const baseRequest = {
  parentComponentId: 'test-component',
  dateUpdated: '2026-08-19',
  userId: 'test-user',
};

describe('Running Hours validation toggle contract', () => {
  it('defers policy-dependent Add Delta checks until the vessel policy is resolved', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'addDelta',
      value: 0,
    });

    expect(result.success).toBe(true);
    expect(() => validateCascadePolicyRules(result.data, true, false)).toThrow('addDelta mode requires value > 0');
  });

  it('allows a negative Add Delta value when the resolved vessel policy is off', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'addDelta',
      value: -25,
    });

    expect(result.success).toBe(true);
    expect(() => validateCascadePolicyRules(result.data, false, true)).not.toThrow();
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
    });

    expect(result.success).toBe(true);
    expect(() => validateCascadePolicyRules(result.data, false, true)).not.toThrow();
  });

  it('requires zero-reset confirmation when the resolved vessel policy is on', () => {
    const result = cascadeRunningHoursSchema.safeParse({
      ...baseRequest,
      mode: 'setTotal',
      value: 0,
    });

    expect(result.success).toBe(true);
    expect(() => validateCascadePolicyRules(result.data, true, false)).toThrow('renewal confirmation');
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

    expect(result.success).toBe(true);
    expect(() => validateCascadePolicyRules(result.data, false, false)).toThrow('addDelta mode requires value > 0');
  });

  it('defaults a vessel without settings to validation ON', () => {
    expect(isRhValidationEnabledForVessel(undefined)).toBe(true);
    expect(isRhValidationEnabledForVessel({})).toBe(true);
  });

  it('keeps validation policy isolated by the vessel settings row', () => {
    const vesselA = { rhValidationEnabled: false };
    const vesselB = { rhValidationEnabled: true };

    expect(isRhValidationEnabledForVessel(vesselA)).toBe(false);
    expect(isRhValidationEnabledForVessel(vesselB)).toBe(true);
  });
});
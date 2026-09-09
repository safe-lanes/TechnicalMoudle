import { describe, expect, it } from 'vitest';
import { isRhValidationEnabledForComponent } from '../../../../client/src/pages/pms/rhValidationPolicy';

describe('mixed-vessel RH validation policy', () => {
  const mixedPolicies = [
    { vesselId: 'vessel-off', rhValidationEnabled: false },
    { vesselId: 'vessel-on', rhValidationEnabled: true },
  ];

  it('allows an OFF-policy vessel correction in an aggregate list', () => {
    expect(isRhValidationEnabledForComponent('vessel-off', 'all', mixedPolicies)).toBe(false);
  });

  it('continues to enforce validation for an ON-policy vessel in the same aggregate list', () => {
    expect(isRhValidationEnabledForComponent('vessel-on', 'all', mixedPolicies)).toBe(true);
  });

  it('fails closed to ON for a component without a settings row', () => {
    expect(isRhValidationEnabledForComponent('vessel-unconfigured', 'all', mixedPolicies)).toBe(true);
  });
});
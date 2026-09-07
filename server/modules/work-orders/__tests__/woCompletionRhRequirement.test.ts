import { describe, expect, it } from 'vitest';
import { requiresWoCompletionRh } from '@shared/workOrders/woCompletionRhRequirement';

describe('requiresWoCompletionRh', () => {
  it.each([
    ['MASTER', true],
    ['INHERITED', true],
    ['master', true],
  ])('requires completion RH for Running Hours %s components', (counterType, expected) => {
    expect(requiresWoCompletionRh('Running Hours', counterType)).toBe(expected);
  });

  it.each([
    ['Running Hours', 'NOT_RH_DRIVEN'],
    ['Running Hours', ''],
    ['Calendar', 'MASTER'],
    ['Condition', 'INHERITED'],
    ['Dual Frequency', 'MASTER'],
  ])('does not require completion RH for basis %s and counter %s', (basis, counterType) => {
    expect(requiresWoCompletionRh(basis, counterType)).toBe(false);
  });
});
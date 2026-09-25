import { describe, expect, it } from 'vitest';
import { resolveCanAct } from '@/components/approvals/approvalGate';

// 25-Sep-2026 — old Level 1 / Level 2 ticks retired: engine-governed actions are engine-only.
describe('resolveCanAct (engine-only approvals)', () => {
  const noChain = { hasChain: false, canDecide: false };
  it('engine-governed, running chain, current approver → can act', () => {
    expect(resolveCanAct({ hasChain: true, canDecide: true }, false)).toBe(true);
  });
  it('engine-governed, running chain, not the current approver → cannot act (legacy ignored)', () => {
    expect(resolveCanAct({ hasChain: true, canDecide: false }, true)).toBe(false);
  });
  it('engine-governed, NO chain → cannot act even when the old legacy gate says yes', () => {
    expect(resolveCanAct(noChain, true)).toBe(false);
  });
  it('not engine-governed (Work-Order-target CR) → legacy gate decides', () => {
    expect(resolveCanAct(noChain, true, false)).toBe(true);
    expect(resolveCanAct(noChain, false, false)).toBe(false);
  });
});

/**
 * DEMO approval card — the Phase-1 proof consumer. Lives OUTSIDE server/modules/approval-engine/
 * on purpose: the engine imports nothing from here (boundary), this file imports only the
 * engine's public types (inward dependency, allowed).
 *
 * 2 screens, 2 classifications each, fake roles, in-memory resolveApprovers/onDecision with
 * call recording so tests can assert exactly-once semantics.
 */
import type { ApprovalCard, DecisionNotice, Scope } from '../modules/approval-engine';

export interface DemoRecorder {
  decisions: DecisionNotice[];
  pendings: Array<{ requuid: string; nodeKey: string; approverUserIds: string[] }>;
  reset(): void;
}

export const DEMO_ROLES = [
  { roleId: 'demo-role-reviewer', roleLabel: 'Demo Reviewer' },
  { roleId: 'demo-role-manager', roleLabel: 'Demo Manager' },
  { roleId: 'demo-role-director', roleLabel: 'Demo Director' },
];
/** roleId → user ids holding it (per-tenant map; 'default' used when tenant unknown). */
export const DEMO_HOLDERS: Record<string, Record<string, string[]>> = {
  default: {
    'demo-role-reviewer': ['user-rev-1', 'user-rev-2'],
    'demo-role-manager': ['user-mgr-1'],
    'demo-role-director': ['user-dir-1', 'user-dir-2', 'user-dir-3'],
  },
};

export function makeDemoCard(overrides: Partial<ApprovalCard> = {}): { card: ApprovalCard; recorder: DemoRecorder } {
  const recorder: DemoRecorder = {
    decisions: [], pendings: [],
    reset() { this.decisions = []; this.pendings = []; },
  };
  const card: ApprovalCard = {
    moduleId: 'demo',
    label: 'Demo Module',
    scopes: [
      {
        screenId: 'demo-requests', actionId: '', label: 'Demo Requests',
        classifications: [{ id: 'normal', label: 'Normal' }, { id: 'critical', label: 'Critical' }],
      },
      {
        screenId: 'demo-orders', actionId: 'close', label: 'Demo Orders — Close',
        classifications: [{ id: 'small', label: 'Small' }, { id: 'large', label: 'Large' }],
      },
    ],
    async listRoles() { return DEMO_ROLES; },
    async classify(_ctx, scope: Scope, subject: unknown) {
      const s = subject as { critical?: boolean; amount?: number } | null;
      if (scope.screenId === 'demo-requests') return s?.critical ? 'critical' : 'normal';
      return (s?.amount ?? 0) > 1000 ? 'large' : 'small';
    },
    async resolveApprovers(ctx, _scope, roleId) {
      const perTenant = DEMO_HOLDERS[ctx.tenantId] ?? DEMO_HOLDERS.default;
      return perTenant[roleId] ?? [];
    },
    async onDecision(_ctx, notice) { recorder.decisions.push(notice); },
    async onPending(_ctx, evt) { recorder.pendings.push({ requuid: evt.requuid, nodeKey: evt.nodeKey, approverUserIds: evt.approverUserIds }); },
    ...overrides,
  };
  return { card, recorder };
}

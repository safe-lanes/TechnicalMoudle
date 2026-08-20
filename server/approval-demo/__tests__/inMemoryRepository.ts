/**
 * In-memory ApprovalRepository TEST DOUBLE (not a production implementation — design v3 §A6
 * keeps Drizzle/Postgres as the only production repo). Mirrors the contract exactly, including
 * the single-fire finalize guard. Lives OUTSIDE the engine folder with the demo fixtures.
 */
import type { ApprovalRepository, TenantRepositoryProvider } from '../../modules/approval-engine';
import type {
  PendingItem, RequestRow, RequestSlotRow, Scope, SlotUpdate,
  StoredWorkflow, StoredWorkflowSummary, WorkflowDefInput,
} from '../../modules/approval-engine';

const sk = (s: Scope) => `${s.moduleId}/${s.screenId}/${s.actionId}`;
let seq = 0;

export class InMemoryApprovalRepository implements ApprovalRepository {
  workflows: StoredWorkflow[] = [];
  requests = new Map<string, RequestRow>();
  slots = new Map<string, RequestSlotRow[]>();
  scopeSettings = new Map<string, boolean>();

  async getActiveWorkflow(scope: Scope, classification: string): Promise<StoredWorkflow | null> {
    return this.workflows.find((w) => sk(w.scope) === sk(scope) && w.classification === classification && w.status === 'active') ?? null;
  }
  async getWorkflow(wfuuid: string): Promise<StoredWorkflow | null> {
    return this.workflows.find((w) => w.wfuuid === wfuuid) ?? null;
  }
  async listWorkflows(scope?: Scope): Promise<StoredWorkflowSummary[]> {
    return this.workflows
      .filter((w) => !scope || sk(w.scope) === sk(scope))
      .map(({ nodes: _n, edges: _e, ...rest }) => ({ ...rest }));
  }
  async saveWorkflowVersion(def: WorkflowDefInput, actor: string): Promise<StoredWorkflow> {
    const existing = this.workflows.filter((w) => sk(w.scope) === sk(def.scope) && w.classification === def.classification);
    const version = existing.reduce((m, w) => Math.max(m, w.version), 0) + 1;
    for (const w of existing) if (w.status === 'active') w.status = 'superseded';
    const stored: StoredWorkflow = {
      ...structuredClone(def), wfuuid: `wf-${++seq}`, version, status: 'active',
      createdBy: actor, createdAt: new Date().toISOString(),
    };
    this.workflows.push(stored);
    return stored;
  }
  async getScopeEnabled(scope: Scope): Promise<boolean> { return this.scopeSettings.get(sk(scope)) ?? true; }
  async setScopeEnabled(scope: Scope, enabled: boolean): Promise<void> { this.scopeSettings.set(sk(scope), enabled); }

  async createRequest(row: RequestRow, slots: RequestSlotRow[]): Promise<void> {
    this.requests.set(row.requuid, structuredClone(row));
    this.slots.set(row.requuid, structuredClone(slots));
  }
  async getRequest(requuid: string): Promise<RequestRow | null> {
    const r = this.requests.get(requuid);
    return r ? structuredClone(r) : null;
  }
  async findPendingBySubject(scope: Scope, subjectRef: string): Promise<RequestRow | null> {
    for (const r of Array.from(this.requests.values())) {
      if (sk(r.scope) === sk(scope) && r.subjectRef === subjectRef && r.status === 'pending') return structuredClone(r);
    }
    return null;
  }
  async listBySubject(scope: Scope, subjectRef: string): Promise<RequestRow[]> {
    return Array.from(this.requests.values())
      .filter((r) => sk(r.scope) === sk(scope) && r.subjectRef === subjectRef)
      .map((r) => structuredClone(r));
  }
  async getSlots(requuid: string): Promise<RequestSlotRow[]> { return structuredClone(this.slots.get(requuid) ?? []); }
  async applySlotUpdates(requuid: string, updates: SlotUpdate[], setCurrentNodeKey?: string | null): Promise<void> {
    const list = this.slots.get(requuid) ?? [];
    for (const u of updates) {
      const s = list.find((x) => x.nodeKey === u.nodeKey && x.slotOrdinal === u.slotOrdinal);
      if (!s) continue;
      s.status = u.status;
      if (u.resolvedApproverIds !== undefined) s.resolvedApproverIds = u.resolvedApproverIds;
      if (u.decidedBy !== undefined) s.decidedBy = u.decidedBy;
      if (u.decidedAt !== undefined) s.decidedAt = u.decidedAt ?? null;
      if (u.remarks !== undefined) s.remarks = u.remarks ?? null;
    }
    if (setCurrentNodeKey !== undefined) {
      const r = this.requests.get(requuid);
      if (r) r.currentNodeKey = setCurrentNodeKey;
    }
  }
  async finalizeRequest(requuid: string, status: 'approved' | 'returned'): Promise<boolean> {
    const r = this.requests.get(requuid);
    if (!r || r.status !== 'pending') return false;   // single-fire guard, same as the SQL transition
    r.status = status; r.finalizedAt = new Date().toISOString(); r.currentNodeKey = null;
    return true;
  }
  async pendingSlotsForUser(userId: string): Promise<PendingItem[]> {
    const out: PendingItem[] = [];
    for (const r of Array.from(this.requests.values())) {
      if (r.status !== 'pending') continue;
      for (const s of this.slots.get(r.requuid) ?? []) {
        if (s.status === 'active' && (s.resolvedApproverIds ?? []).includes(userId)) {
          out.push({
            requuid: r.requuid, scope: r.scope, classification: r.classification, subjectRef: r.subjectRef,
            nodeKey: s.nodeKey, nodeLabel: r.snapshot.nodes.find((n) => n.key === s.nodeKey)?.label ?? s.nodeKey,
            roleId: s.roleId, roleLabel: s.roleLabel, submittedAt: r.submittedAt,
          });
        }
      }
    }
    return out;
  }
}

export class InMemoryProvider implements TenantRepositoryProvider {
  repos = new Map<string, InMemoryApprovalRepository>();
  forTenant(tenantId: string): InMemoryApprovalRepository {
    let r = this.repos.get(tenantId);
    if (!r) { r = new InMemoryApprovalRepository(); this.repos.set(tenantId, r); }
    return r;
  }
}

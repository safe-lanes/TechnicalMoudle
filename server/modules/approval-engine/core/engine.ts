/**
 * Approval Engine core (design v3 §B4). Service-shaped: plain JSON DTOs in and out,
 * card callbacks through the in-process adapter (the ApprovalCard object itself in v1),
 * persistence through ApprovalRepository, tenancy through the provider. No Express here.
 */
import { randomUUID } from 'node:crypto';
import type {
  ApprovalCard, DecideInput, DecideResult, EngineCtx, EngineEvent, PendingItem,
  RequestRow, RequestSlotRow, Scope, SlotUpdate, StoredWorkflow, StoredWorkflowSummary,
  SubmitInput, SubmitOutcome, WorkflowDefInput,
} from './types';
import { CardRegistry } from './registry';
import type { TenantRepositoryProvider } from './repository';
import { entryNodeKey, nextNodeKey, validateWorkflowV1 } from './validateWorkflow';

export class EngineError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) { super(message); }
}
const err = (statusCode: number, code: string, message: string): never => { throw new EngineError(statusCode, message, code); };

export interface EngineDeps {
  registry: CardRegistry;
  provider: TenantRepositoryProvider;
  /** v3 §A8 — the engine emits; whoever wires it decides transport. Errors are swallowed. */
  onEvent?: (evt: EngineEvent) => void;
  now?: () => Date;
}

export class ApprovalEngine {
  constructor(private deps: EngineDeps) {}

  private emit(evt: EngineEvent) {
    try { this.deps.onEvent?.(evt); } catch (e) { console.error('[approval-engine] onEvent listener failed:', e); }
  }
  private nowIso() { return (this.deps.now?.() ?? new Date()).toISOString(); }
  private repo(ctx: EngineCtx) { return this.deps.provider.forTenant(ctx.tenantId); }
  private cardFor(scope: Scope) {
    const hit = this.deps.registry.findScope(scope);
    if (!hit) err(404, 'UNKNOWN_SCOPE', `no registered card scope ${scope.moduleId}/${scope.screenId}/${scope.actionId}`);
    return hit!;
  }

  registryTree() { return this.deps.registry.tree(); }

  async listRoles(ctx: EngineCtx, scope: Scope) {
    const { card } = this.cardFor(scope);
    return card.listRoles({ tenantId: ctx.tenantId }, scope);
  }

  // ── workflows ──────────────────────────────────────────────────────────────
  async saveWorkflow(ctx: EngineCtx, def: WorkflowDefInput): Promise<StoredWorkflow> {
    const { scope: cardScope } = this.cardFor(def.scope);
    if (!cardScope.classifications.some((c) => c.id === def.classification)) {
      err(400, 'UNKNOWN_CLASSIFICATION', `classification '${def.classification}' is not declared by the card`);
    }
    validateWorkflowV1(def); // throws WorkflowValidationError (400 at the HTTP layer)
    return this.repo(ctx).saveWorkflowVersion(def, ctx.actor.userId);
  }
  async listWorkflows(ctx: EngineCtx, scope?: Scope): Promise<StoredWorkflowSummary[]> {
    return this.repo(ctx).listWorkflows(scope);
  }
  async getWorkflow(ctx: EngineCtx, wfuuid: string): Promise<StoredWorkflow> {
    const wf = await this.repo(ctx).getWorkflow(wfuuid);
    if (!wf) err(404, 'NOT_FOUND', `workflow ${wfuuid} not found`);
    return wf!;
  }
  async getScopeEnabled(ctx: EngineCtx, scope: Scope): Promise<boolean> {
    this.cardFor(scope);
    return this.repo(ctx).getScopeEnabled(scope);
  }
  async setScopeEnabled(ctx: EngineCtx, scope: Scope, enabled: boolean): Promise<void> {
    this.cardFor(scope);
    return this.repo(ctx).setScopeEnabled(scope, enabled, ctx.actor.userId);
  }

  // ── submit ─────────────────────────────────────────────────────────────────
  async submit(ctx: EngineCtx, input: SubmitInput): Promise<SubmitOutcome> {
    const { card, scope: cardScope } = this.cardFor(input.scope);
    const repo = this.repo(ctx);

    if (!(await repo.getScopeEnabled(input.scope))) return { outcome: 'DISABLED' };

    const classification = await card.classify({ tenantId: ctx.tenantId }, input.scope, input.subject);
    if (!cardScope.classifications.some((c) => c.id === classification)) {
      err(500, 'BAD_CLASSIFY', `card classified to '${classification}', which it did not declare`);
    }

    const wf = await repo.getActiveWorkflow(input.scope, classification);
    if (!wf) return { outcome: 'NO_WORKFLOW' };

    const already = await repo.findPendingBySubject(input.scope, input.subjectRef);
    if (already) return { outcome: 'ALREADY_PENDING', requuid: already.requuid };

    const requuid = randomUUID();
    const now = this.nowIso();
    const request: RequestRow = {
      requuid,
      scope: input.scope,
      classification,
      subjectRef: input.subjectRef,
      vesselId: input.vesselId ?? null,
      snapshot: { scope: wf.scope, classification: wf.classification, mode: wf.mode, label: wf.label, nodes: wf.nodes, edges: wf.edges, wfuuid: wf.wfuuid, version: wf.version },
      status: 'pending',
      currentNodeKey: null,
      submittedBy: ctx.actor.userId,
      submittedAt: now,
      finalizedAt: null,
    };
    const slots: RequestSlotRow[] = [];
    for (const n of wf.nodes) {
      if (n.type !== 'approval-step') continue;
      (n.slots ?? []).forEach((s, i) => slots.push({
        requuid, nodeKey: n.key, slotOrdinal: i, roleId: s.roleId, roleLabel: s.roleLabel,
        status: 'pending', resolvedApproverIds: null, decidedBy: null, decidedAt: null, remarks: null,
      }));
    }
    await repo.createRequest(request, slots);
    const entry = entryNodeKey(wf);
    await this.activateNode(ctx, card, request, entry);
    return { outcome: 'STARTED', requuid, activeNodeKey: entry };
  }

  /** Resolve approvers per slot of the node, mark them active, move the pointer, emit. */
  private async activateNode(ctx: EngineCtx, card: ApprovalCard, request: RequestRow, nodeKey: string): Promise<void> {
    const repo = this.repo(ctx);
    const node = request.snapshot.nodes.find((n) => n.key === nodeKey)!;
    const updates: SlotUpdate[] = [];
    const approverUnion = new Set<string>();
    for (let i = 0; i < (node.slots ?? []).length; i++) {
      const slot = (node.slots ?? [])[i];
      const ids = await card.resolveApprovers({ tenantId: ctx.tenantId }, request.scope, slot.roleId, request.subjectRef);
      // F3 safety-net: a slot that resolves to zero approvers activates with no one able to
      // decide — the request would sit stuck with no button and no notification. Never let that
      // be silent: warn loudly (support/logs) here; the UI surfaces it via the empty
      // resolvedApproverIds (ApprovalChainProgress "no approver resolved" marker).
      if (ids.length === 0) {
        console.warn(
          `[approval-engine] ZERO APPROVERS RESOLVED — request ${request.requuid} node "${nodeKey}" slot ${i} role "${slot.roleLabel ?? slot.roleId}" scope ${JSON.stringify(request.scope)} subject ${request.subjectRef}. The step will stall until an approver resolves for this role/vessel.`,
        );
      }
      ids.forEach((id) => approverUnion.add(id));
      updates.push({ nodeKey, slotOrdinal: i, status: 'active', resolvedApproverIds: ids });
    }
    await repo.applySlotUpdates(request.requuid, updates, nodeKey);
    const evt = { requuid: request.requuid, scope: request.scope, subjectRef: request.subjectRef, nodeKey, approverUserIds: Array.from(approverUnion) };
    this.emit({ type: 'step-activated', tenantId: ctx.tenantId, ...evt });
    if (card.onPending) {
      try { await card.onPending({ tenantId: ctx.tenantId }, evt); }
      catch (e) { console.error('[approval-engine] card.onPending failed (ignored):', e); }
    }
  }

  // ── decide ─────────────────────────────────────────────────────────────────
  async decide(ctx: EngineCtx, requuid: string, input: DecideInput): Promise<DecideResult> {
    const repo = this.repo(ctx);
    const request = await repo.getRequest(requuid);
    if (!request) err(404, 'NOT_FOUND', `request ${requuid} not found`);
    if (request!.status !== 'pending') {
      err(409, 'ALREADY_DECIDED', `request ${requuid} is already ${request!.status}`);
    }
    const { card } = this.cardFor(request!.scope);
    const slots = await repo.getSlots(requuid);
    const active = slots.filter((s) => s.status === 'active');
    // F3b: admins (Sail/Super/PMS Admin) can always decide a pending request — parity with the
    // legacy Sail-Admin bypass. This makes a Super Admin CONFIGURED as an approver actually able
    // to act (their crew master_users row may be absent, so resolveApprovers can't name them),
    // and lets an admin unstick a step that resolved to zero approvers (F3 safety-net).
    const isAdminActor = !!ctx.actor.isAdmin;
    let mine = active.find((s) => (s.resolvedApproverIds ?? []).includes(ctx.actor.userId));
    if (!mine && isAdminActor) mine = active[0];
    if (!mine) {
      err(403, 'NOT_YOUR_TURN', 'you are not an approver for the currently active step of this request');
    }
    const now = this.nowIso();
    const nodeKey = mine!.nodeKey;
    const node = request!.snapshot.nodes.find((n) => n.key === nodeKey)!;
    const nodeSlots = slots.filter((s) => s.nodeKey === nodeKey);

    if (input.decision === 'reject') {
      const updates: SlotUpdate[] = [
        { nodeKey, slotOrdinal: mine!.slotOrdinal, status: 'rejected', decidedBy: ctx.actor.userId, decidedAt: now, remarks: input.remarks ?? null },
        // every other non-terminal slot of the whole request is superseded — NEVER deleted (audit)
        ...slots
          .filter((s) => !(s.nodeKey === nodeKey && s.slotOrdinal === mine!.slotOrdinal))
          .filter((s) => s.status === 'active' || s.status === 'pending')
          .map((s) => ({ nodeKey: s.nodeKey, slotOrdinal: s.slotOrdinal, status: 'superseded' as const })),
      ];
      await repo.applySlotUpdates(requuid, updates, null);
      return this.finalize(ctx, card, request!, 'returned', ctx.actor.userId, input.remarks ?? null, nodeKey);
    }

    // approve
    const updates: SlotUpdate[] = [
      { nodeKey, slotOrdinal: mine!.slotOrdinal, status: 'approved', decidedBy: ctx.actor.userId, decidedAt: now, remarks: input.remarks ?? null },
    ];
    const approvedCount = nodeSlots.filter((s) => s.status === 'approved').length + 1;
    const rule = node.quorum!;
    const needed = rule.rule === 'all' ? nodeSlots.length : rule.rule === 'any' ? 1 : (rule.n as number);
    const satisfied = approvedCount >= needed;
    if (satisfied) {
      for (const s of nodeSlots) {
        if (s.slotOrdinal === mine!.slotOrdinal) continue;
        if (s.status === 'active') updates.push({ nodeKey, slotOrdinal: s.slotOrdinal, status: 'superseded' });
      }
    }
    await repo.applySlotUpdates(requuid, updates, undefined);
    if (!satisfied) {
      return { requuid, requestStatus: 'pending', nodeKey, nodeSatisfied: false, activatedNodeKey: null };
    }
    const next = nextNodeKey(request!.snapshot, nodeKey);
    const nextNode = request!.snapshot.nodes.find((n) => n.key === next!);
    if (!nextNode || nextNode.type === 'end') {
      return this.finalize(ctx, card, request!, 'approved', ctx.actor.userId, input.remarks ?? null, nodeKey);
    }
    await this.activateNode(ctx, card, request!, nextNode.key);
    return { requuid, requestStatus: 'pending', nodeKey, nodeSatisfied: true, activatedNodeKey: nextNode.key };
  }

  /** Terminal transition + exactly-once onDecision (guarded by the repository transition). */
  private async finalize(
    ctx: EngineCtx, card: ApprovalCard, request: RequestRow,
    status: 'approved' | 'returned', decidedBy: string, remarks: string | null, nodeKey: string,
  ): Promise<DecideResult> {
    const transitioned = await this.repo(ctx).finalizeRequest(request.requuid, status);
    let callbackError: string | undefined;
    if (transitioned) {
      if (status === 'approved') {
        this.emit({ type: 'request-completed', tenantId: ctx.tenantId, requuid: request.requuid, scope: request.scope, subjectRef: request.subjectRef });
      } else {
        this.emit({ type: 'request-returned', tenantId: ctx.tenantId, requuid: request.requuid, scope: request.scope, subjectRef: request.subjectRef, returnedBy: decidedBy, remarks });
      }
      try {
        await card.onDecision({ tenantId: ctx.tenantId }, {
          requuid: request.requuid, scope: request.scope, classification: request.classification,
          subjectRef: request.subjectRef, outcome: status, decidedBy, remarks,
        });
      } catch (e: any) {
        // The terminal state is committed; the card owns idempotent recovery (see INTEGRATION-GUIDE).
        callbackError = e?.message || String(e);
        console.error(`[approval-engine] card.onDecision failed for ${request.requuid} (state already ${status}):`, e);
      }
    }
    return { requuid: request.requuid, requestStatus: status, nodeKey, nodeSatisfied: true, activatedNodeKey: null, callbackError };
  }

  // ── reads ──────────────────────────────────────────────────────────────────
  async status(ctx: EngineCtx, scope: Scope, subjectRef: string): Promise<Array<RequestRow & { slots: RequestSlotRow[] }>> {
    const repo = this.repo(ctx);
    const rows = await repo.listBySubject(scope, subjectRef);
    return Promise.all(rows.map(async (r) => ({ ...r, slots: await repo.getSlots(r.requuid) })));
  }
  async pendingForUser(ctx: EngineCtx, userId: string): Promise<PendingItem[]> {
    return this.repo(ctx).pendingSlotsForUser(userId);
  }
}

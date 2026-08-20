/**
 * The only production ApprovalRepository implementation — Drizzle over node-postgres.
 * One instance per tenant Pool; DrizzlePoolProvider maps tenantId → repository (v3 §A7).
 */
import { and, desc, eq, max } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ApprovalRepository, TenantRepositoryProvider } from '../core/repository';
import type {
  PendingItem, RequestRow, RequestSlotRow, Scope, SlotUpdate,
  StoredWorkflow, StoredWorkflowSummary, WorkflowDefInput,
} from '../core/types';
import {
  apprvNodeEdges, apprvNodeSlots, apprvRequestSlots, apprvRequests,
  apprvScopeSettings, apprvWorkflowNodes, apprvWorkflows,
} from './schema';

const scopeEq = (t: { moduleId: any; screenId: any; actionId: any }, s: Scope) =>
  and(eq(t.moduleId, s.moduleId), eq(t.screenId, s.screenId), eq(t.actionId, s.actionId));

export class DrizzleApprovalRepository implements ApprovalRepository {
  private db: NodePgDatabase;
  constructor(private pool: Pool) { this.db = drizzle(pool); }

  // ── workflows ──────────────────────────────────────────────────────────────
  private async hydrate(row: typeof apprvWorkflows.$inferSelect): Promise<StoredWorkflow> {
    const [nodes, edges, slots] = await Promise.all([
      this.db.select().from(apprvWorkflowNodes).where(eq(apprvWorkflowNodes.workflowWfuuid, row.wfuuid)),
      this.db.select().from(apprvNodeEdges).where(eq(apprvNodeEdges.workflowWfuuid, row.wfuuid)),
      this.db.select().from(apprvNodeSlots).where(eq(apprvNodeSlots.workflowWfuuid, row.wfuuid)),
    ]);
    return {
      wfuuid: row.wfuuid,
      scope: { moduleId: row.moduleId, screenId: row.screenId, actionId: row.actionId },
      classification: row.classification,
      mode: row.mode as StoredWorkflow['mode'],
      label: row.label,
      version: row.version,
      status: row.status as StoredWorkflow['status'],
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      nodes: nodes
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((n) => ({
          key: n.nodeKey, type: n.type as any, label: n.label, ordinal: n.ordinal,
          quorum: n.quorumRule ? { rule: n.quorumRule as any, n: n.quorumN ?? undefined } : undefined,
          slots: slots.filter((s) => s.nodeKey === n.nodeKey).sort((a, b) => a.slotOrdinal - b.slotOrdinal)
            .map((s) => ({ roleId: s.roleId, roleLabel: s.roleLabel })),
        })),
      edges: edges.map((e) => ({ from: e.fromKey, to: e.toKey })),
    };
  }

  async getActiveWorkflow(scope: Scope, classification: string): Promise<StoredWorkflow | null> {
    const rows = await this.db.select().from(apprvWorkflows)
      .where(and(scopeEq(apprvWorkflows, scope), eq(apprvWorkflows.classification, classification),
        eq(apprvWorkflows.status, 'active'), eq(apprvWorkflows.isDeleted, false)))
      .limit(1);
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async getWorkflow(wfuuid: string): Promise<StoredWorkflow | null> {
    const rows = await this.db.select().from(apprvWorkflows).where(eq(apprvWorkflows.wfuuid, wfuuid)).limit(1);
    return rows[0] ? this.hydrate(rows[0]) : null;
  }

  async listWorkflows(scope?: Scope): Promise<StoredWorkflowSummary[]> {
    const rows = scope
      ? await this.db.select().from(apprvWorkflows).where(and(scopeEq(apprvWorkflows, scope), eq(apprvWorkflows.isDeleted, false))).orderBy(desc(apprvWorkflows.version))
      : await this.db.select().from(apprvWorkflows).where(eq(apprvWorkflows.isDeleted, false)).orderBy(desc(apprvWorkflows.createdAt));
    return rows.map((r) => ({
      wfuuid: r.wfuuid, scope: { moduleId: r.moduleId, screenId: r.screenId, actionId: r.actionId },
      classification: r.classification, mode: r.mode as any, label: r.label,
      version: r.version, status: r.status, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(),
    }));
  }

  async saveWorkflowVersion(def: WorkflowDefInput, actor: string): Promise<StoredWorkflow> {
    const wfuuid = randomUUID();
    await this.db.transaction(async (tx) => {
      const [{ v }] = await tx.select({ v: max(apprvWorkflows.version) }).from(apprvWorkflows)
        .where(and(scopeEq(apprvWorkflows, def.scope), eq(apprvWorkflows.classification, def.classification)));
      const version = (v ?? 0) + 1;
      // supersede the previous active BEFORE inserting (partial unique index on active)
      await tx.update(apprvWorkflows).set({ status: 'superseded' })
        .where(and(scopeEq(apprvWorkflows, def.scope), eq(apprvWorkflows.classification, def.classification), eq(apprvWorkflows.status, 'active')));
      await tx.insert(apprvWorkflows).values({
        wfuuid, moduleId: def.scope.moduleId, screenId: def.scope.screenId, actionId: def.scope.actionId,
        classification: def.classification, mode: def.mode, version, status: 'active', label: def.label, createdBy: actor,
      });
      for (const n of def.nodes) {
        await tx.insert(apprvWorkflowNodes).values({
          workflowWfuuid: wfuuid, nodeKey: n.key, type: n.type, ordinal: n.ordinal,
          quorumRule: n.quorum?.rule ?? null, quorumN: n.quorum?.n ?? null, label: n.label ?? '',
        });
        for (let i = 0; i < (n.slots ?? []).length; i++) {
          const s = (n.slots ?? [])[i];
          await tx.insert(apprvNodeSlots).values({ workflowWfuuid: wfuuid, nodeKey: n.key, slotOrdinal: i, roleId: s.roleId, roleLabel: s.roleLabel });
        }
      }
      for (const e of def.edges) {
        await tx.insert(apprvNodeEdges).values({ workflowWfuuid: wfuuid, fromKey: e.from, toKey: e.to });
      }
    });
    return (await this.getWorkflow(wfuuid))!;
  }

  // ── scope settings ─────────────────────────────────────────────────────────
  async getScopeEnabled(scope: Scope): Promise<boolean> {
    const rows = await this.db.select().from(apprvScopeSettings).where(scopeEq(apprvScopeSettings, scope)).limit(1);
    return rows[0]?.enabled ?? true; // default enabled (v3 §A7)
  }
  async setScopeEnabled(scope: Scope, enabled: boolean, actor: string): Promise<void> {
    const updated = await this.db.update(apprvScopeSettings).set({ enabled, updatedBy: actor, updatedAt: new Date() })
      .where(scopeEq(apprvScopeSettings, scope)).returning();
    if (updated.length === 0) {
      await this.db.insert(apprvScopeSettings)
        .values({ moduleId: scope.moduleId, screenId: scope.screenId, actionId: scope.actionId, enabled, updatedBy: actor })
        .onConflictDoUpdate({
          target: [apprvScopeSettings.moduleId, apprvScopeSettings.screenId, apprvScopeSettings.actionId],
          set: { enabled, updatedBy: actor, updatedAt: new Date() },
        });
    }
  }

  // ── requests ───────────────────────────────────────────────────────────────
  private toRequestRow(r: typeof apprvRequests.$inferSelect): RequestRow {
    return {
      requuid: r.requuid,
      scope: { moduleId: r.moduleId, screenId: r.screenId, actionId: r.actionId },
      classification: r.classification, subjectRef: r.subjectRef, vesselId: r.vesselId,
      snapshot: r.snapshotJson as RequestRow['snapshot'],
      status: r.status as RequestRow['status'], currentNodeKey: r.currentNodeKey,
      submittedBy: r.submittedBy, submittedAt: r.submittedAt.toISOString(),
      finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null,
    };
  }

  async createRequest(row: RequestRow, slots: RequestSlotRow[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(apprvRequests).values({
        requuid: row.requuid, moduleId: row.scope.moduleId, screenId: row.scope.screenId, actionId: row.scope.actionId,
        classification: row.classification, subjectRef: row.subjectRef, vesselId: row.vesselId,
        snapshotJson: row.snapshot, status: row.status, currentNodeKey: row.currentNodeKey,
        submittedBy: row.submittedBy, submittedAt: new Date(row.submittedAt),
        workflowWfuuid: row.snapshot.wfuuid, workflowVersion: row.snapshot.version,
      });
      for (const s of slots) {
        await tx.insert(apprvRequestSlots).values({
          requuid: s.requuid, nodeKey: s.nodeKey, slotOrdinal: s.slotOrdinal, roleId: s.roleId, roleLabel: s.roleLabel,
          status: s.status, resolvedApproverIdsJson: s.resolvedApproverIds, decidedBy: s.decidedBy,
          decidedAt: s.decidedAt ? new Date(s.decidedAt) : null, remarks: s.remarks,
        });
      }
    });
  }

  async getRequest(requuid: string): Promise<RequestRow | null> {
    const rows = await this.db.select().from(apprvRequests).where(eq(apprvRequests.requuid, requuid)).limit(1);
    return rows[0] ? this.toRequestRow(rows[0]) : null;
  }
  async findPendingBySubject(scope: Scope, subjectRef: string): Promise<RequestRow | null> {
    const rows = await this.db.select().from(apprvRequests)
      .where(and(scopeEq(apprvRequests, scope), eq(apprvRequests.subjectRef, subjectRef), eq(apprvRequests.status, 'pending'))).limit(1);
    return rows[0] ? this.toRequestRow(rows[0]) : null;
  }
  async listBySubject(scope: Scope, subjectRef: string): Promise<RequestRow[]> {
    const rows = await this.db.select().from(apprvRequests)
      .where(and(scopeEq(apprvRequests, scope), eq(apprvRequests.subjectRef, subjectRef)))
      .orderBy(desc(apprvRequests.submittedAt));
    return rows.map((r) => this.toRequestRow(r));
  }
  async getSlots(requuid: string): Promise<RequestSlotRow[]> {
    const rows = await this.db.select().from(apprvRequestSlots).where(eq(apprvRequestSlots.requuid, requuid));
    return rows.sort((a, b) => a.nodeKey.localeCompare(b.nodeKey) || a.slotOrdinal - b.slotOrdinal).map((s) => ({
      requuid: s.requuid, nodeKey: s.nodeKey, slotOrdinal: s.slotOrdinal, roleId: s.roleId, roleLabel: s.roleLabel,
      status: s.status as RequestSlotRow['status'],
      resolvedApproverIds: (s.resolvedApproverIdsJson as string[] | null) ?? null,
      decidedBy: s.decidedBy, decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null, remarks: s.remarks,
    }));
  }

  async applySlotUpdates(requuid: string, updates: SlotUpdate[], setCurrentNodeKey?: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const u of updates) {
        const set: Record<string, unknown> = { status: u.status };
        if (u.resolvedApproverIds !== undefined) set.resolvedApproverIdsJson = u.resolvedApproverIds;
        if (u.decidedBy !== undefined) set.decidedBy = u.decidedBy;
        if (u.decidedAt !== undefined) set.decidedAt = u.decidedAt ? new Date(u.decidedAt) : null;
        if (u.remarks !== undefined) set.remarks = u.remarks;
        await tx.update(apprvRequestSlots).set(set)
          .where(and(eq(apprvRequestSlots.requuid, requuid), eq(apprvRequestSlots.nodeKey, u.nodeKey), eq(apprvRequestSlots.slotOrdinal, u.slotOrdinal)));
      }
      if (setCurrentNodeKey !== undefined) {
        await tx.update(apprvRequests).set({ currentNodeKey: setCurrentNodeKey }).where(eq(apprvRequests.requuid, requuid));
      }
    });
  }

  async finalizeRequest(requuid: string, status: 'approved' | 'returned'): Promise<boolean> {
    const updated = await this.db.update(apprvRequests)
      .set({ status, finalizedAt: new Date(), currentNodeKey: null })
      .where(and(eq(apprvRequests.requuid, requuid), eq(apprvRequests.status, 'pending')))
      .returning({ id: apprvRequests.id });
    return updated.length === 1; // exactly-once guard
  }

  async pendingSlotsForUser(userId: string): Promise<PendingItem[]> {
    // active slots whose resolved ids contain the user, joined to their pending requests
    const rows = await this.db.select({
      requuid: apprvRequestSlots.requuid, nodeKey: apprvRequestSlots.nodeKey,
      roleId: apprvRequestSlots.roleId, roleLabel: apprvRequestSlots.roleLabel,
      ids: apprvRequestSlots.resolvedApproverIdsJson,
      moduleId: apprvRequests.moduleId, screenId: apprvRequests.screenId, actionId: apprvRequests.actionId,
      classification: apprvRequests.classification, subjectRef: apprvRequests.subjectRef,
      submittedAt: apprvRequests.submittedAt, snapshot: apprvRequests.snapshotJson,
    }).from(apprvRequestSlots)
      .innerJoin(apprvRequests, eq(apprvRequests.requuid, apprvRequestSlots.requuid))
      .where(and(eq(apprvRequestSlots.status, 'active'), eq(apprvRequests.status, 'pending')));
    return rows
      .filter((r) => Array.isArray(r.ids) && (r.ids as string[]).includes(userId))
      .map((r) => ({
        requuid: r.requuid,
        scope: { moduleId: r.moduleId, screenId: r.screenId, actionId: r.actionId },
        classification: r.classification, subjectRef: r.subjectRef, nodeKey: r.nodeKey,
        nodeLabel: ((r.snapshot as any)?.nodes ?? []).find((n: any) => n.key === r.nodeKey)?.label ?? r.nodeKey,
        roleId: r.roleId, roleLabel: r.roleLabel, submittedAt: r.submittedAt.toISOString(),
      }));
  }
}

/** tenantId → Pool map. 'default' covers the single-tenant / pilot case. */
export class DrizzlePoolProvider implements TenantRepositoryProvider {
  private repos = new Map<string, DrizzleApprovalRepository>();
  constructor(private pools: Map<string, Pool>) {}
  static fromConnectionStrings(map: Record<string, string>): DrizzlePoolProvider {
    const pools = new Map<string, Pool>();
    for (const [tenant, cs] of Object.entries(map)) pools.set(tenant, new Pool({ connectionString: cs }));
    return new DrizzlePoolProvider(pools);
  }
  forTenant(tenantId: string): DrizzleApprovalRepository {
    const pool = this.pools.get(tenantId) ?? this.pools.get('default');
    if (!pool) throw new Error(`[approval-engine] no database pool for tenant '${tenantId}' and no 'default'`);
    const key = this.pools.has(tenantId) ? tenantId : 'default';
    let repo = this.repos.get(key);
    if (!repo) { repo = new DrizzleApprovalRepository(pool); this.repos.set(key, repo); }
    return repo;
  }
  async end(): Promise<void> { for (const p of Array.from(this.pools.values())) await p.end(); }
}

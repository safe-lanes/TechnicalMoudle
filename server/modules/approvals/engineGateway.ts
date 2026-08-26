/**
 * Phase 2 / W3 — the gateway Technical's services call. Owns:
 *   - the engine instance handle (set at mount; null on ships / before mount),
 *   - EngineCtx construction (tenant from ALS, actor from the caller),
 *   - maybeSubmit* / maybeDecide* wrappers with the SACRED fallback contract:
 *     engine absent / scope disabled / no workflow → return null and the caller runs its
 *     LEGACY path byte-identically,
 *   - EngineError → AppError translation (asyncHandler understands AppError only),
 *   - the shore-side ARRIVAL SWEEP (CRs / postponement WOs that arrived via sync).
 */
import { ApprovalEngine, EngineError, type EngineCtx, type Scope } from '../approval-engine';
import { AppError } from '../shared/errors';
import { currentEngineTenantId } from './tenantProvider';
import { TECHNICAL_MODULE_ID, type TechnicalSubject } from './approvalCard';
import { getRequestContext } from '../../middleware/requestContext';

// F3b (Q3): host admin roles that get the engine decide-override on a zero-approver step.
// Mirror of mount.ts APPROVAL_ADMIN_ROLES — the CR/postpone service path builds its ctx here
// (not via mount.resolveActor), so it must compute isAdmin from the request's REAL rbac role.
const APPROVAL_ADMIN_ROLES: ReadonlySet<string> = new Set(['Sail Admin', 'Super Admin', 'PMS Admin']);

let engine: ApprovalEngine | null = null;
export function setTechnicalEngine(e: ApprovalEngine | null): void { engine = e; }
export function getTechnicalEngine(): ApprovalEngine | null { return engine; }

export const techScope = (screenId: string): Scope => ({ moduleId: TECHNICAL_MODULE_ID, screenId, actionId: '' });

export function engineCtx(actorUserId: string | null | undefined): EngineCtx {
  const rbacRole = getRequestContext()?.rbacRole ?? null;
  return {
    tenantId: currentEngineTenantId(),
    actor: {
      userId: actorUserId || 'system',
      role: rbacRole,
      userType: null,
      isAdmin: !!rbacRole && APPROVAL_ADMIN_ROLES.has(rbacRole),
    },
  };
}

function translate(e: unknown): never {
  if (e instanceof EngineError) throw new AppError(e.statusCode, e.message, { code: e.code });
  throw e;
}

/**
 * Submit a subject to the engine if it is mounted. Returns the requuid when a chain STARTED,
 * null on every fallback outcome (engine off / NO_WORKFLOW / DISABLED / ALREADY_PENDING —
 * the pending chain keeps running; a re-submit must not fork a second one). Never throws
 * for fallback reasons; classification errors are logged and swallowed (legacy continues).
 */
export async function maybeEngineSubmit(screenId: string, subjectRef: string, subject: TechnicalSubject, vesselId: string | null, actorUserId?: string | null): Promise<string | null> {
  if (!engine) return null;
  try {
    const r = await engine.submit(engineCtx(actorUserId), { scope: techScope(screenId), subjectRef, subject, vesselId });
    if (r.outcome === 'STARTED') {
      console.log(`[approvals] chain STARTED ${screenId} ${subjectRef} (${r.requuid})`);
      return r.requuid;
    }
    if (r.outcome === 'ALREADY_PENDING') return null;
    return null; // NO_WORKFLOW / DISABLED → legacy
  } catch (e) {
    // A submit failure must never break the module's own flow — the legacy path still runs.
    console.error(`[approvals] engine submit failed for ${screenId} ${subjectRef} (legacy path continues):`, e);
    return null;
  }
}

/** The pending engine request for a subject, or null. */
export async function pendingEngineRequest(screenId: string, subjectRef: string) {
  if (!engine) return null;
  const rows = await engine.status(engineCtx(null), techScope(screenId), subjectRef).catch(() => []);
  return rows.find((r) => r.status === 'pending') ?? null;
}

/**
 * Decide on the pending engine request for a subject, if one exists. Returns null when the
 * engine does not own this subject (caller runs the legacy path). The engine's own refusals
 * (403 not-your-turn, 409 decided) surface as AppError — safety intact.
 * On a terminal decision the card's onDecision has ALREADY applied the module change
 * (it calls back into the legacy finalise, which finds no pending engine request and
 * proceeds); callers reload and return their entity.
 */
export async function maybeEngineDecide(
  screenId: string, subjectRef: string, decision: 'approve' | 'reject',
  actorUserId: string, remarks?: string | null,
): Promise<{ requestStatus: string; nodeSatisfied: boolean; activatedNodeKey: string | null } | null> {
  if (!engine) return null;
  const pending = await pendingEngineRequest(screenId, subjectRef);
  if (!pending) return null;
  try {
    const r = await engine.decide(engineCtx(actorUserId), pending.requuid, { decision, remarks: remarks ?? undefined });
    if (r.callbackError) {
      // Terminal state committed but the module apply failed — loud, actionable.
      throw new AppError(500, `Approval recorded but applying the result failed: ${r.callbackError}. The apply is idempotent — retry via support.`, { code: 'APPLY_FAILED', requuid: r.requuid });
    }
    return { requestStatus: r.requestStatus, nodeSatisfied: r.nodeSatisfied, activatedNodeKey: r.activatedNodeKey };
  } catch (e) { translate(e); }
}

// ── Arrival sweep (W3: "hook the arrival point, not only the create route") ──────────────
/**
 * Shore-side: submit anything awaiting office approval that has no engine request yet —
 * covers subjects that ARRIVED VIA SYNC (ship-created CRs, ship postponement requests) and
 * doubles as the retry for missed direct hooks. Idempotent by construction (ALREADY_PENDING
 * short-circuits; NO_WORKFLOW/DISABLED do nothing). Fired post-sync per vessel and after
 * shore-side submits. Postponement vs re-postponement: a WO whose postponement history
 * already holds an Approved decision row is a RE-postponement (matches the module's own
 * split: submitRePostponeRequest is only reachable after an approved postponement).
 */
export async function approvalArrivalSweep(vesselId: string): Promise<{ submitted: number }> {
  if (!engine) return { submitted: 0 };
  const { getPostgresClient } = await import('../../postgresClient');
  const { db } = getPostgresClient();
  const { changeRequest, workOrders, workOrderPostponements } = await import('@shared/schema');
  const { and, eq } = await import('drizzle-orm');
  let submitted = 0;

  const crs = await db.select().from(changeRequest)
    .where(and(eq(changeRequest.vesselId, vesselId), eq(changeRequest.status, 'submitted')));
  for (const cr of crs) {
    const cls = await (await import('../change-requests/services/changeRequestsService')).classifyChangeRequestScope(cr);
    if (!cls.functionId) continue; // work_order-target CRs etc. — no engine scope, legacy only
    const requuid = await maybeEngineSubmit(cls.functionId, cr.cruuid, { kind: 'cr', targetType: cr.targetType, targetId: cr.targetId }, cr.vesselId, cr.requestedByUserId);
    if (requuid) submitted++;
  }

  const wos = await db.select().from(workOrders)
    .where(and(eq(workOrders.vesselId, vesselId), eq(workOrders.status, 'Awaiting Office Approval')));
  for (const wo of wos) {
    const rows = await db.select().from(workOrderPostponements).where(eq(workOrderPostponements.workOrderId, wo.wouuid));
    const awaiting = rows.some((r) => r.status === 'Awaiting Approval');
    if (!awaiting) continue;
    const isRe = rows.some((r) => r.status === 'Approved');
    const screenId = isRe ? 'pms-wo-re-postponement' : 'pms-wo-postponement';
    const requuid = await maybeEngineSubmit(screenId, wo.wouuid, { kind: 'wo', workOrderId: wo.wouuid }, wo.vesselId, wo.postponeApprover ?? null);
    if (requuid) submitted++;
  }

  if (submitted > 0) console.log(`[approvals] arrival sweep vessel ${vesselId}: ${submitted} chain(s) started`);
  return { submitted };
}

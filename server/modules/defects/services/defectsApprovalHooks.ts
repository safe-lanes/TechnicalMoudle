/**
 * DEFECTS × APPROVAL ENGINE — the B2(a) gate and its applies (03-Sep-2026).
 *
 * Defects has ONE live write path — the generic PATCH /defects/:id (Phase A finding) —
 * so the approval gate lives INSIDE that path: gateDefectUpdate() inspects the incoming
 * body against the stored row and routes approval-field writes engine-first. A raw PATCH
 * cannot bypass the gate because the PATCH *is* the gate.
 *
 * SACRED FALLBACK: engine absent / NO_WORKFLOW / DISABLED → every write passes through
 * byte-identically (legacy self-approve included) — with ONE deliberate, product-approved
 * deviation (Ghazi, 03-Sep-2026): on SHIP instances extension entries are ALWAYS
 * submit-only ('Requested') and extension decisions are refused, chain or no chain. Ships
 * cannot ask the shore-only engine what is configured, and ship-side self-approval is the
 * exact behaviour the product owner asked to end. The ship UI hides the approve radios to
 * match (DefectFormWizard B5).
 *
 * CLOSURE (Part C1) is NOT on the engine: Master-only permission rule, enforced here
 * server-side (rank from the SAILERP-forwarded x-rank header — the platform's only
 * server-visible rank source; same trust level as the rest of Phase-0 auth).
 */
import { AppError } from '../../shared/errors';
import * as defectsRepo from '../repositories/defectsRepository';
import {
  DEFECTS_MODULE_ID, DEFECTS_EXTENSION_SCREEN, DEFECTS_REPEAT_EXTENSION_SCREEN,
  DEFECTS_VERIFICATION_SCREEN, DEFECT_CLASS_CRITICAL, DEFECT_CLASS_NORMAL,
  defectClassificationFactors, deciderIdentity, type DefectSubject,
} from '../approvalCard';
import {
  scopeFor, engineSubmitOutcome, maybeEngineSubmitScoped, activeWorkflowExistsScoped,
  maybeEngineDecideScoped, pendingEngineRequestScoped, pendingEngineRequestInScopes,
} from '../../approvals/engineGateway';
import type { Scope } from '../../approval-engine';

export interface DefectActor {
  userUuid?: string | null;
  rankName?: string | null;
  role?: string | null;
}

const extScope = () => scopeFor(DEFECTS_MODULE_ID, DEFECTS_EXTENSION_SCREEN);
const repeatExtScope = () => scopeFor(DEFECTS_MODULE_ID, DEFECTS_REPEAT_EXTENSION_SCREEN);
const verScope = () => scopeFor(DEFECTS_MODULE_ID, DEFECTS_VERIFICATION_SCREEN);
const extensionScopes = (): Scope[] => [extScope(), repeatExtScope()];

type ExtensionEntry = {
  id: string; existingTargetDate: string; newTargetDate: string; reasonForExtension: string;
  submitForApprovalTo: string; submitForApprovalToName: string;
  status: 'Requested' | 'Approved' | 'Rejected';
  approved?: boolean; approvalDate: string; approverComments: string;
  electronicConfirmation?: string; requestedAt: string;
};

export interface DefectApprovalRouting {
  scope: Scope;
  classification: string;
  factors: {
    isCoC: boolean;
    isCriticalComponent: boolean;
    approvedExtensionCount: number;
    currentTargetDate: string | null;
    newTargetDate: string | null;
    extensionDays: number | null;
    longExtensionThreshold: number;
    exceedsThreshold: boolean;
  };
  activeWorkflowExists: boolean;
  fellBackFromRepeatScope: boolean;
}

const calendarDayNumber = (value: string): number => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const display = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const year = iso ? Number(iso[1]) : display ? Number(display[3]) : NaN;
  const month = iso ? Number(iso[2]) : display ? months.indexOf(display[2].toLowerCase()) + 1 : NaN;
  const day = iso ? Number(iso[3]) : display ? Number(display[1]) : NaN;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1) {
    throw new AppError(400, `Invalid date '${value}'; expected YYYY-MM-DD or DD-MMM-YYYY`);
  }
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new AppError(400, `Invalid calendar date '${value}'`);
  }
  return Math.floor(utc / 86_400_000);
};

/**
 * Production and diagnostic routing share this function. It is called only when a request
 * is about to be submitted; existing requests use their persisted apprv_requests scope.
 */
export async function resolveDefectApprovalRouting(
  duuid: string,
  action: 'extension' | 'verification',
  newTargetDate: string | null,
  actorUserId?: string | null,
  options: { auditFallback?: boolean } = {},
): Promise<DefectApprovalRouting> {
  const defect: any = await defectsRepo.getDefect(duuid);
  if (!defect) throw new AppError(404, `Defect ${duuid} not found`);
  const subjectRef: string = defect.duuid;
  const settings = await defectsRepo.getDefectApprovalSettings();
  const threshold = settings?.longExtensionDays ?? 90;
  const base = await defectClassificationFactors(subjectRef);
  const entries: any[] = Array.isArray(defect.targetDateExtensions) ? defect.targetDateExtensions : [];
  const approvedExtensionCount = entries.filter((entry) => (entry?.status ?? entry?.state) === 'Approved').length;
  const currentTargetDate = defect.targetCloseDate || null;
  let extensionDays: number | null = null;
  if (action === 'extension') {
    if (!currentTargetDate) throw new AppError(400, 'Current target date is required to route an extension');
    if (!newTargetDate) throw new AppError(400, 'newTargetDate is required when action=extension');
    extensionDays = calendarDayNumber(newTargetDate) - calendarDayNumber(currentTargetDate);
  }
  const exceedsThreshold = extensionDays !== null && extensionDays > threshold;
  const classification = base.isCoC || base.isCriticalComponent || exceedsThreshold
    ? DEFECT_CLASS_CRITICAL
    : DEFECT_CLASS_NORMAL;
  let scope = action === 'verification'
    ? verScope()
    : approvedExtensionCount > 0 ? repeatExtScope() : extScope();
  let activeWorkflowExists = await activeWorkflowExistsScoped(scope, classification);
  let fellBackFromRepeatScope = false;

  if (scope.screenId === DEFECTS_REPEAT_EXTENSION_SCREEN && !activeWorkflowExists) {
    fellBackFromRepeatScope = true;
    const reason = `No active ${DEFECTS_REPEAT_EXTENSION_SCREEN} workflow for classification '${classification}'; using ${DEFECTS_EXTENSION_SCREEN}`;
    console.warn(`[approvals] ${reason} (${subjectRef})`);
    if (options.auditFallback !== false) {
      await defectsRepo.createAuditLog({
        userId: actorUserId || 'system',
        entityType: 'defect_approval_routing',
        entityId: subjectRef,
        actionType: 'fallback',
        fieldName: 'scope',
        oldValue: DEFECTS_REPEAT_EXTENSION_SCREEN,
        newValue: DEFECTS_EXTENSION_SCREEN,
        source: 'system',
        payload: { reason, classification },
      });
    }
    scope = extScope();
    activeWorkflowExists = await activeWorkflowExistsScoped(scope, classification);
  }

  return {
    scope,
    classification,
    factors: {
      isCoC: base.isCoC,
      isCriticalComponent: base.isCriticalComponent,
      approvedExtensionCount,
      currentTargetDate,
      newTargetDate: action === 'extension' ? newTargetDate : null,
      extensionDays,
      longExtensionThreshold: threshold,
      exceedsThreshold,
    },
    activeWorkflowExists,
    fellBackFromRepeatScope,
  };
}

/** Part C1 closeout fields — writing/changing ANY of these is "performing closure". */
const C1_FIELDS = [
  'confirmCompleted', 'dateCompleted', 'closedByName', 'closedByRank',
  'closedOutByName', 'closedOutByRank', 'closureComment', 'closedBy', 'closedOn', 'closureFiles',
] as const;

/** Loose change detection: the wizard echoes the WHOLE form on every save, so unchanged
 *  fields (including '' vs null vs undefined vs false noise) must never trip a gate. */
const norm = (v: unknown): unknown => (v === undefined || v === null || v === '' ? null : v);
const changedValue = (incoming: unknown, current: unknown): boolean =>
  incoming !== undefined && JSON.stringify(norm(incoming)) !== JSON.stringify(norm(current));

const isShip = async (): Promise<boolean> => (await import('../../sync/syncRole')).isShipInstance();

/**
 * The gate. Returns the (possibly rewritten) body to persist plus post-save submit work.
 * Throws AppError 403/409 where a write must be refused outright.
 */
export async function gateDefectUpdate(
  current: any, body: any, actor: DefectActor,
): Promise<{ body: any; postSave: Array<() => Promise<void>> }> {
  const postSave: Array<() => Promise<void>> = [];
  const out = { ...body };
  const duuid: string = current.duuid;
  const vesselId: string | null = current.vesselId ?? null;
  const onShip = await isShip();

  // ── Closure (Part C1) — Master-only permission rule (NOT the engine) ────────────
  const c1Changed = C1_FIELDS.some((f) => changedValue(out[f], current[f]));
  if (c1Changed && (actor.rankName || '').trim() !== 'Master') {
    throw new AppError(403, 'Only the Master may perform defect closure (Part C1 Closeout).', { code: 'CLOSURE_MASTER_ONLY' });
  }

  // ── Verification (Part C2) — engine-governed when a chain is configured ─────────
  if (changedValue(out.verified, current.verified)) {
    const wantVerified = out.verified === true;
    const subject: DefectSubject = { kind: 'defect-verification', duuid };
    if (wantVerified && !onShip) {
      const stripVerifyFields = () => {
        delete out.verified; delete out.dateVerified; delete out.verifiedByName; delete out.verifiedByOfficePosition;
      };
      const pending = await pendingEngineRequestScoped(verScope(), duuid);
      if (pending) {
        // Approver's Verify click = the decision. Engine refuses non-approvers (403).
        const decided = await maybeEngineDecideScoped(verScope(), duuid, 'approve', actor.userUuid || 'anonymous', out.approverComments ?? null);
        if (!decided) throw new AppError(409, 'The pending verification request changed; refresh and try again.', { code: 'APPROVAL_REQUEST_CHANGED' });
        stripVerifyFields(); // onDecision already wrote the verified fields (synced path)
      } else {
        const outcome = await engineSubmitOutcome(verScope(), duuid, subject, vesselId, actor.userUuid);
        if (outcome === 'STARTED' || outcome === 'ALREADY_PENDING') {
          // One-click for an authorised approver: decide the fresh chain immediately.
          try {
            const decided = await maybeEngineDecideScoped(verScope(), duuid, 'approve', actor.userUuid || 'anonymous', out.approverComments ?? null);
            if (!decided) throw new AppError(409, 'The pending verification request changed; refresh and try again.', { code: 'APPROVAL_REQUEST_CHANGED' });
            stripVerifyFields();
          } catch (e: any) {
            if (e?.statusCode === 403) {
              stripVerifyFields();
              throw new AppError(409, 'Verification is now pending approval — an authorised approver must verify this defect.', { code: 'VERIFICATION_PENDING' });
            }
            throw e;
          }
        }
        // OFF / NO_WORKFLOW / DISABLED / ERROR → legacy passthrough (byte-identical)
      }
    } else if (!wantVerified && !onShip) {
      const pending = await pendingEngineRequestScoped(verScope(), duuid);
      if (pending) throw new AppError(409, 'A verification approval is pending for this defect — it cannot be un-verified now.', { code: 'VERIFICATION_PENDING' });
      // no pending → legacy un-verify passes through
    }
    // ship: engine not mounted — legacy passthrough (client gate unchanged)
  }

  // ── Extension (Part B5) — engine-governed when a chain is configured ────────────
  if (Array.isArray(out.targetDateExtensions)) {
    const currentEntries: ExtensionEntry[] = Array.isArray(current.targetDateExtensions) ? current.targetDateExtensions : [];
    const currentById = new Map(currentEntries.map((e) => [e.id, e]));
    const entries: ExtensionEntry[] = out.targetDateExtensions.map((e: ExtensionEntry) => ({ ...e }));
    let decisionApplied = false;

    const downgradeToRequested = (e: ExtensionEntry) => {
      e.status = 'Requested';
      delete e.approved; e.approvalDate = ''; e.approverComments = e.approverComments || '';
      delete e.electronicConfirmation;
      // The wizard advances targetCloseDate/isDeferred client-side on approve — a
      // downgraded (now pending) request must not carry that side effect.
      delete out.targetCloseDate; delete out.isDeferred;
    };

    for (const e of entries) {
      const cur = currentById.get(e.id);
      if (!cur) {
        // NEW entry
        if (onShip) {
          if (e.status !== 'Requested' || e.approved !== undefined) downgradeToRequested(e); // ship = submit-only (approved deviation)
          continue; // engine is shore-only; the arrival sweep submits after sync
        }
        if (e.status === 'Requested') {
          const routing = await resolveDefectApprovalRouting(duuid, 'extension', e.newTargetDate, actor.userUuid);
          if (routing.activeWorkflowExists && currentEntries.some((entry) => entry.status === 'Requested')) {
            throw new AppError(409, 'An extension approval is already pending for this defect.', { code: 'EXTENSION_PENDING' });
          }
          const subject: DefectSubject = {
            kind: 'defect-extension', duuid, extensionId: e.id, classification: routing.classification,
          };
          postSave.push(async () => { await maybeEngineSubmitScoped(routing.scope, duuid, subject, vesselId, actor.userUuid); });
        } else {
          // Created-and-self-approved in one save. Chain configured → force submit-only.
          const routing = await resolveDefectApprovalRouting(duuid, 'extension', e.newTargetDate, actor.userUuid);
          if (routing.activeWorkflowExists && currentEntries.some((entry) => entry.status === 'Requested')) {
            throw new AppError(409, 'An extension approval is already pending for this defect.', { code: 'EXTENSION_PENDING' });
          }
          const subject: DefectSubject = {
            kind: 'defect-extension', duuid, extensionId: e.id, classification: routing.classification,
          };
          const outcome = await engineSubmitOutcome(routing.scope, duuid, subject, vesselId, actor.userUuid);
          if (outcome === 'STARTED' || outcome === 'ALREADY_PENDING') downgradeToRequested(e);
          // fallback outcomes → legacy self-approve passes through byte-identically
        }
        continue;
      }
      const isDecision = cur.status === 'Requested' && (e.status === 'Approved' || e.status === 'Rejected');
      if (!isDecision) continue; // non-status edits pass through

      if (onShip) throw new AppError(403, 'Extension approvals are decided ashore.', { code: 'EXTENSION_DECIDED_ASHORE' });
      const governedEntry = currentEntries.find((entry) => entry.status === 'Requested');
      if (governedEntry?.id !== e.id) {
        throw new AppError(409, 'This extension is not the pending approval entry; refresh and decide the oldest pending extension.', { code: 'APPROVAL_REQUEST_CHANGED' });
      }

      const decideAs = e.status === 'Approved' ? 'approve' as const : 'reject' as const;
      const existing = await pendingEngineRequestInScopes(extensionScopes(), duuid);
      if (existing) {
        // Use the request's persisted scope. Never recompute from the now-mutable extension count.
        const decided = await maybeEngineDecideScoped(existing.scope, duuid, decideAs, actor.userUuid || 'anonymous', e.approverComments ?? null);
        if (!decided) throw new AppError(409, 'The pending extension request changed; refresh and try again.', { code: 'APPROVAL_REQUEST_CHANGED' });
        decisionApplied = true; // onDecision wrote the entry + side effects
      } else {
        const routing = await resolveDefectApprovalRouting(duuid, 'extension', e.newTargetDate, actor.userUuid);
        const subject: DefectSubject = {
          kind: 'defect-extension', duuid, extensionId: e.id, classification: routing.classification,
        };
        const outcome = await engineSubmitOutcome(routing.scope, duuid, subject, vesselId, actor.userUuid);
        if (outcome === 'STARTED' || outcome === 'ALREADY_PENDING') {
          try {
            const decided = await maybeEngineDecideScoped(routing.scope, duuid, decideAs, actor.userUuid || 'anonymous', e.approverComments ?? null);
            if (!decided) throw new AppError(409, 'The pending extension request changed; refresh and try again.', { code: 'APPROVAL_REQUEST_CHANGED' });
            decisionApplied = true;
          } catch (err: any) {
            if (err?.statusCode === 403) {
              downgradeToRequested(e);
              throw new AppError(409, 'Extension submitted for approval — an authorised approver must decide it.', { code: 'EXTENSION_PENDING' });
            }
            throw err;
          }
        }
        // fallback outcomes → legacy self-approve passes through byte-identically
      }
    }

    if (decisionApplied) {
      // onDecision persisted the authoritative entry state (and targetCloseDate/isDeferred
      // on approval) through the synced repo path — the stale client copy must not
      // overwrite it. Refresh from the row as it stands now.
      const fresh = await defectsRepo.getDefect(duuid);
      out.targetDateExtensions = fresh?.targetDateExtensions ?? entries;
      delete out.targetCloseDate; delete out.isDeferred;
    } else {
      out.targetDateExtensions = entries;
    }
  }

  return { body: out, postSave };
}

/** Post-save trigger: C1 closeout just completed (confirmCompleted flipped true) on shore
 *  → raise the verification chain. NO_WORKFLOW → nothing (B7: unconfigured = legacy). */
export async function afterDefectUpdate(previous: any, updated: any, actor: DefectActor): Promise<void> {
  if (await isShip()) return; // shore-only; ship closures reach the chain via the arrival sweep
  if (updated.confirmCompleted === true && previous.confirmCompleted !== true && updated.verified !== true) {
    const subject: DefectSubject = { kind: 'defect-verification', duuid: updated.duuid };
    await maybeEngineSubmitScoped(verScope(), updated.duuid, subject, updated.vesselId ?? null, actor.userUuid);
  }
}

// ── onDecision applies (idempotent; writes via the repo → field-logged → synced) ────────

export async function applyExtensionDecision(duuid: string, approve: boolean, remarks: string, decidedBy: string): Promise<void> {
  const defect: any = await defectsRepo.getDefect(duuid);
  if (!defect) throw new AppError(404, `[approvals] defect ${duuid} not found for extension decision`);
  const entries: ExtensionEntry[] = Array.isArray(defect.targetDateExtensions) ? [...defect.targetDateExtensions] : [];
  // FIFO: the chain governs the OLDEST still-Requested entry (one pending chain per scope).
  const idx = entries.findIndex((e) => e.status === 'Requested');
  if (idx === -1) {
    console.log(`[approvals] defects extension onDecision no-op (no Requested entry) for ${duuid}`);
    return; // idempotent replay / entry withdrawn
  }
  const who = await deciderIdentity(decidedBy);
  const today = new Date().toISOString().split('T')[0];
  const entry = { ...entries[idx] };
  entry.status = approve ? 'Approved' : 'Rejected';
  entry.approved = approve;
  entry.approvalDate = today;
  entry.approverComments = remarks;
  entry.electronicConfirmation = `${approve ? 'Approved' : 'Rejected'} via approval workflow by ${who.name} on ${today}`;
  entries[idx] = entry;
  const update: any = { targetDateExtensions: entries };
  if (approve && entry.newTargetDate) {
    // Mirror of the legacy client-side apply (DefectFormWizard: approve advanced the target date).
    update.targetCloseDate = entry.newTargetDate;
    update.isDeferred = true;
  }
  await defectsRepo.updateDefect(defect.id, update);
  console.log(`[approvals] defect ${defect.id} extension ${entry.id} ${entry.status} by ${who.name}`);
}

export async function applyVerificationDecision(duuid: string, approve: boolean, remarks: string, decidedBy: string): Promise<void> {
  const defect: any = await defectsRepo.getDefect(duuid);
  if (!defect) throw new AppError(404, `[approvals] defect ${duuid} not found for verification decision`);
  if (!approve) {
    // Returned: verified stays false; the remarks reach the submitter via the engine's
    // notification. No defect field records verification rejection (none exists today).
    console.log(`[approvals] defect ${defect.id} verification RETURNED (${remarks})`);
    return;
  }
  if (defect.verified === true) {
    console.log(`[approvals] defects verification onDecision no-op (already verified) for ${duuid}`);
    return; // idempotent replay
  }
  const who = await deciderIdentity(decidedBy);
  await defectsRepo.updateDefect(defect.id, {
    verified: true,
    dateVerified: new Date().toISOString().split('T')[0],
    verifiedByName: who.name,
    verifiedByOfficePosition: who.roleLabel,
  });
  console.log(`[approvals] defect ${defect.id} VERIFIED via approval workflow by ${who.name}`);
}

// ── Arrival sweep leg (called from approvalArrivalSweep per vessel, shore post-sync) ────

export async function sweepDefectsForApproval(vesselId: string): Promise<number> {
  const { getPostgresClient } = await import('../../../postgresClient');
  const { getCurrentTenantContext } = await import('../../../utils/asyncLocalStorage');
  const ctx = getCurrentTenantContext();
  const db = ctx ? ctx.db : getPostgresClient().db;
  const { defects } = await import('@shared/schema');
  const { and, eq, or, isNull, sql } = await import('drizzle-orm');
  let submitted = 0;

  const rows: any[] = await db.select({
    duuid: defects.duuid, vesselId: defects.vesselId,
    targetDateExtensions: defects.targetDateExtensions,
    confirmCompleted: defects.confirmCompleted, verified: defects.verified,
  }).from(defects).where(and(
    eq(defects.vesselId, vesselId),
    or(eq(defects.isDeleted, false), isNull(defects.isDeleted)),
    sql`(
      ${defects.targetDateExtensions}::jsonb @> '[{"status":"Requested"}]'::jsonb
      OR (${defects.confirmCompleted} IS TRUE AND ${defects.verified} IS NOT TRUE)
    )`,
  ));

  for (const d of rows) {
    const hasRequested = Array.isArray(d.targetDateExtensions) && d.targetDateExtensions.some((e: any) => e?.status === 'Requested');
    if (hasRequested) {
      const extension = d.targetDateExtensions.find((e: any) => e?.status === 'Requested');
      const routing = await resolveDefectApprovalRouting(d.duuid, 'extension', extension?.newTargetDate ?? null, null);
      const subject: DefectSubject = {
        kind: 'defect-extension',
        duuid: d.duuid,
        extensionId: extension?.id,
        classification: routing.classification,
      };
      const requuid = await maybeEngineSubmitScoped(routing.scope, d.duuid, subject, d.vesselId, null);
      if (requuid) submitted++;
    }
    if (d.confirmCompleted === true && d.verified !== true) {
      const requuid = await maybeEngineSubmitScoped(verScope(), d.duuid, { kind: 'defect-verification', duuid: d.duuid } as DefectSubject, d.vesselId, null);
      if (requuid) submitted++;
    }
  }
  return submitted;
}

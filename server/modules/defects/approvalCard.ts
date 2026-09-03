/**
 * DEFECTS approval card — the second card on the engine (03-Sep-2026). Lives outside the
 * engine folder (boundary rule). Product scope (final, product owner):
 *   - ON the engine: Extension (Part B5 target-date extension) and Verification (Part C2).
 *   - NOT on the engine: Closure (Part C1) — a plain Master-only permission rule enforced
 *     in defectsService, and defect creation (never approved).
 *   - TWO classifications: 'Critical Equipment / COC Related' vs 'Normal'.
 *
 * CLASSIFICATION SOURCE (product decision, 03-Sep-2026): the LINKED COMPONENT's
 * Criticality field (components.critical) OR the defect's own COC flag (defects.is_coc).
 * Deliberately NOT Technical's predicate (critical || classItem) — the owner named the
 * Criticality field specifically and excluded Class Item. Do not "align" the two cards.
 *
 * Role resolution and vessel scoping are the shared D-1 rules —
 * resolveRoleApproverUserIds in ../approvals/approvalCard.ts (strict vessel scope flag
 * included). No moc pool pseudo-roles here: Defects has no legacy approver pool and its
 * decorative awc rows are not being migrated (see DEFECTS-INTEGRATION-REPORT.md).
 */
import { and, eq } from 'drizzle-orm';
import type { ApprovalCard, DecisionNotice, Scope } from '../approval-engine';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { admnRoleMaster, components, defects, masterUsers } from '@shared/schema';
import { resolveRoleApproverUserIds } from '../approvals/approvalCard';
import { AppError } from '../shared/errors';

export const DEFECTS_MODULE_ID = 'defects';
export const DEFECTS_EXTENSION_SCREEN = 'defects-extension';
export const DEFECTS_VERIFICATION_SCREEN = 'defects-verification';
/** Stable classification ids — these ARE the admin-matrix variable names (2-bucket model). */
export const DEFECT_CLASS_CRITICAL = 'Critical Equipment / COC Related';
export const DEFECT_CLASS_NORMAL = 'Normal';

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

/** The subject payload Defects hands to submit(). subjectRef is always the defect duuid;
 *  extensionId (client-generated EXT-<ts>) pins which B5 entry a chain was raised for. */
export type DefectSubject =
  | { kind: 'defect-extension'; duuid: string; extensionId?: string }
  | { kind: 'defect-verification'; duuid: string };

/**
 * Two-bucket classification for BOTH scopes. Missing component (no link, or link points
 * nowhere) simply contributes "not critical" — a defect with no linked component and no
 * COC flag is Normal, never an error (defects.componentId is nullable by design).
 */
export async function classifyDefect(duuid: string): Promise<string> {
  const defect = (await db().select({ isCoc: defects.is_coc, componentId: defects.componentId })
    .from(defects).where(eq(defects.duuid, duuid)).limit(1))[0];
  if (!defect) throw new AppError(404, `[approvals] defect ${duuid} not found for classification`);
  if (defect.isCoc === true) return DEFECT_CLASS_CRITICAL;
  if (defect.componentId) {
    const comp = (await db().select({ critical: components.critical })
      .from(components).where(eq(components.cuuid, defect.componentId)).limit(1))[0];
    if (comp?.critical === true) return DEFECT_CLASS_CRITICAL;
  }
  return DEFECT_CLASS_NORMAL;
}

async function defectVesselId(subjectRef: string): Promise<string | null> {
  const rows = await db().select({ v: defects.vesselId }).from(defects)
    .where(eq(defects.duuid, subjectRef)).limit(1);
  return rows[0]?.v ?? null;
}

export const defectsApprovalCard: ApprovalCard = {
  moduleId: DEFECTS_MODULE_ID,
  label: 'Defects',
  scopes: [
    { screenId: DEFECTS_EXTENSION_SCREEN, actionId: '', label: 'Defect Target Date Extension',
      classifications: [{ id: DEFECT_CLASS_CRITICAL, label: DEFECT_CLASS_CRITICAL }, { id: DEFECT_CLASS_NORMAL, label: DEFECT_CLASS_NORMAL }] },
    { screenId: DEFECTS_VERIFICATION_SCREEN, actionId: '', label: 'Defect Verification (C2)',
      classifications: [{ id: DEFECT_CLASS_CRITICAL, label: DEFECT_CLASS_CRITICAL }, { id: DEFECT_CLASS_NORMAL, label: DEFECT_CLASS_NORMAL }] },
  ],

  async listRoles() {
    const roles = await db().select({ ruid: admnRoleMaster.ruid, name: admnRoleMaster.assignedRole })
      .from(admnRoleMaster)
      .where(and(eq(admnRoleMaster.isActive, true), eq(admnRoleMaster.isDeleted, false)));
    return roles.map((r) => ({ roleId: r.ruid, roleLabel: r.name }));
  },

  async classify(_ctx, _scope: Scope, subject: unknown) {
    const s = subject as DefectSubject;
    if (!s?.duuid) throw new AppError(400, `[approvals] defect scopes need a {duuid} subject`);
    return classifyDefect(s.duuid);
  },

  async resolveApprovers(_ctx, _scope: Scope, roleId: string, subjectRef: string) {
    return resolveRoleApproverUserIds(roleId, await defectVesselId(subjectRef));
  },

  async onDecision(_ctx, notice: DecisionNotice) {
    // Engine finalized BEFORE this call (single-fire); the applies below are idempotent
    // (already-applied state = no-op) and write through the defects repo/storage layer,
    // which field-logs into the normal defects sync (BOTH_EDITABLE) — never apprv_*.
    const { applyExtensionDecision, applyVerificationDecision } = await import('./services/defectsApprovalHooks');
    const approve = notice.outcome === 'approved';
    const remarks = notice.remarks ?? (approve ? 'Approved via approval workflow' : 'Returned via approval workflow');
    if (notice.scope.screenId === DEFECTS_EXTENSION_SCREEN) {
      await applyExtensionDecision(notice.subjectRef, approve, remarks, notice.decidedBy);
    } else if (notice.scope.screenId === DEFECTS_VERIFICATION_SCREEN) {
      await applyVerificationDecision(notice.subjectRef, approve, remarks, notice.decidedBy);
    } else {
      throw new AppError(400, `[approvals] unknown defects scope ${notice.scope.screenId}`);
    }
  },
};

/** Decider display name + role label for stamping the defect fields (mirrors what the
 *  legacy client auto-filled from the logged-in user). Falls back to the uuid. */
export async function deciderIdentity(userUuid: string): Promise<{ name: string; roleLabel: string }> {
  const u = (await db().select({ name: masterUsers.fullName, role: masterUsers.role })
    .from(masterUsers).where(eq(masterUsers.id, userUuid)).limit(1))[0];
  return { name: u?.name || userUuid, roleLabel: u?.role || 'Office' };
}

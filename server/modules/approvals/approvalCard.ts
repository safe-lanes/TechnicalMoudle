/**
 * Phase 2 / W2 — the TECHNICAL approval card. Lives outside the engine folder (boundary).
 * Scopes = the six Technical approval functions (4 CR types + postponement + re-postponement);
 * classification ids ARE the awc variableNames (stable config keys, 1:1 with the matrix
 * generator). WO completion is NOT here (D-3 — Phase 7).
 *
 * D-1 ROLE RESOLUTION (final): chains store stable role ids.
 *   - real roles: admn_role_master.ruid → assigned_role name → master_users.role (name join,
 *     is_deleted=false). Ship-typed roles are additionally scoped to the subject's vessel via
 *     LOGIN-CAPTURED assignments (master_user_vessels, is_active=true); Office-typed roles
 *     resolve fleet-wide. ⚠️ STALENESS CAVEAT: master_user_vessels refreshes when the user
 *     LOGS IN (capture-at-login) — a crew change appears to the resolver only after the new
 *     user's first login, and a transferred-off user remains resolvable until eviction. This
 *     is accepted (product owner, D-1); no org chart.
 *   - pool roles: 'moc:Level 1' / 'moc:Level 2' → the legacy moc_approvers pool
 *     (modulename 'Technical', is_active=1) — exactly the set verifyApproverForLevel admits.
 *     These exist for the D-2 matrix migration (quorum-`any` pool slots per level).
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { ApprovalCard, DecisionNotice, Scope } from '../approval-engine';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { admnRoleMaster, masterUsers, masterUserVessels, mocApprovers, changeRequest, workOrders } from '@shared/schema';
import { classifyChangeRequestScope } from '../change-requests/services/changeRequestsService';
import { classifyWoForPostponement, classifyWoForRePostponement } from '../work-orders/services/workOrderService';
import { AppError } from '../shared/errors';

export const TECHNICAL_MODULE_ID = 'technical';
export const MOC_POOL_ROLE_L1 = 'moc:Level 1';
export const MOC_POOL_ROLE_L2 = 'moc:Level 2';
const WO_VARIABLE_NAME: Record<'criticalEquipment' | 'critical' | 'normal', string> = {
  criticalEquipment: 'Critical Equipment WO',
  critical: 'Critical WO',
  normal: 'Normal WO',
};

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

/** The subject payload Technical hands to submit(). */
export type TechnicalSubject =
  | { kind: 'cr'; targetType: string | null; targetId: string | null }
  | { kind: 'wo'; workOrderId: string };

async function subjectVesselId(scope: Scope, subjectRef: string): Promise<string | null> {
  if (scope.screenId.endsWith('-cr')) {
    const rows = await db().select({ v: changeRequest.vesselId }).from(changeRequest).where(eq(changeRequest.cruuid, subjectRef)).limit(1);
    return rows[0]?.v ?? null;
  }
  const rows = await db().select({ v: workOrders.vesselId }).from(workOrders).where(eq(workOrders.wouuid, subjectRef)).limit(1);
  return rows[0]?.v ?? null;
}

export const technicalApprovalCard: ApprovalCard = {
  moduleId: TECHNICAL_MODULE_ID,
  label: 'Technical',
  scopes: [
    { screenId: 'pms-components-cr', actionId: '', label: 'Modify PMS — Component Change Requests',
      classifications: [{ id: 'Normal Equipment', label: 'Normal Equipment' }, { id: 'Critical Equipment', label: 'Critical Equipment' }] },
    { screenId: 'pms-jobs-cr', actionId: '', label: 'Modify PMS — Job Change Requests',
      classifications: [{ id: 'Normal Jobs', label: 'Normal Jobs' }, { id: 'Critical Jobs', label: 'Critical Jobs' }, { id: 'Critical Equipment Jobs', label: 'Critical Equipment Jobs' }] },
    { screenId: 'pms-spares-cr', actionId: '', label: 'Modify PMS — Spare Change Requests',
      classifications: [{ id: 'Normal Spares', label: 'Normal Spares' }, { id: 'Critical Spares', label: 'Critical Spares' }] },
    { screenId: 'pms-stores-cr', actionId: '', label: 'Modify PMS — Store Change Requests',
      classifications: [{ id: 'Store Items', label: 'Store Items' }] },
    { screenId: 'pms-wo-postponement', actionId: '', label: 'Work Order Postponement',
      classifications: [{ id: 'Normal WO', label: 'Normal WO' }, { id: 'Critical WO', label: 'Critical WO' }, { id: 'Critical Equipment WO', label: 'Critical Equipment WO' }] },
    { screenId: 'pms-wo-re-postponement', actionId: '', label: 'Work Order Re-Postponement',
      classifications: [{ id: 'Normal WO', label: 'Normal WO' }, { id: 'Critical WO', label: 'Critical WO' }, { id: 'Critical Equipment WO', label: 'Critical Equipment WO' }] },
  ],

  async listRoles() {
    const roles = await db().select({ ruid: admnRoleMaster.ruid, name: admnRoleMaster.assignedRole })
      .from(admnRoleMaster)
      .where(and(eq(admnRoleMaster.isActive, true), eq(admnRoleMaster.isDeleted, false)));
    return [
      ...roles.map((r) => ({ roleId: r.ruid, roleLabel: r.name })),
      { roleId: MOC_POOL_ROLE_L1, roleLabel: 'Approver Pool — Level 1 (moc list)' },
      { roleId: MOC_POOL_ROLE_L2, roleLabel: 'Approver Pool — Level 2 (moc list)' },
    ];
  },

  async classify(_ctx, scope: Scope, subject: unknown) {
    const s = subject as TechnicalSubject;
    if (scope.screenId.endsWith('-cr')) {
      if (s?.kind !== 'cr') throw new AppError(400, `[approvals] CR scope needs a {kind:'cr'} subject`);
      const cls = await classifyChangeRequestScope(s);
      if (!cls.variableName || cls.functionId !== scope.screenId) {
        throw new AppError(400, `[approvals] CR target does not classify into ${scope.screenId} (got ${cls.functionId ?? 'none'})`);
      }
      return cls.variableName;
    }
    if (s?.kind !== 'wo') throw new AppError(400, `[approvals] WO scope needs a {kind:'wo'} subject`);
    const rows = await db().select().from(workOrders).where(eq(workOrders.wouuid, s.workOrderId)).limit(1);
    if (!rows[0]) throw new AppError(404, `[approvals] work order ${s.workOrderId} not found`);
    const cls = scope.screenId === 'pms-wo-re-postponement'
      ? await classifyWoForRePostponement(rows[0])
      : await classifyWoForPostponement(rows[0]);
    return WO_VARIABLE_NAME[cls.classification];
  },

  async resolveApprovers(_ctx, scope: Scope, roleId: string, subjectRef: string) {
    // pool pseudo-roles (matrix migration, D-2) — the exact verifyApproverForLevel set
    if (roleId === MOC_POOL_ROLE_L1 || roleId === MOC_POOL_ROLE_L2) {
      const level = roleId.slice('moc:'.length);
      const rows = await db().select({ u: mocApprovers.userUuid }).from(mocApprovers)
        .where(and(eq(mocApprovers.approverLevel, level), eq(mocApprovers.isActive, 1),
          eq(mocApprovers.isDeleted, false), eq(mocApprovers.modulename, 'Technical')));
      return rows.map((r) => r.u).filter((u): u is string => !!u);
    }
    // real role (ruid → name join, D-1)
    const role = (await db().select().from(admnRoleMaster)
      .where(and(eq(admnRoleMaster.ruid, roleId), eq(admnRoleMaster.isDeleted, false))).limit(1))[0];
    if (!role) return [];
    const users = await db().select({ id: masterUsers.id }).from(masterUsers)
      .where(and(eq(masterUsers.role, role.assignedRole), eq(masterUsers.isDeleted, false)));
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return [];
    if (role.roletype !== 'Ship') return ids; // office roles resolve fleet-wide (D-1)
    const vesselId = await subjectVesselId(scope, subjectRef);
    if (!vesselId) return [];
    const assigned = await db().select({ u: masterUserVessels.userUuid }).from(masterUserVessels)
      .where(and(eq(masterUserVessels.vesselId, vesselId), eq(masterUserVessels.isActive, true), inArray(masterUserVessels.userUuid, ids)));
    return assigned.map((r) => r.u);
  },

  async onDecision(_ctx, notice: DecisionNotice) {
    // The engine finalized BEFORE this call (single-fire). We invoke the LEGACY finalise
    // paths — Phase-0 hardened and idempotent (CR decide-once 409, postponement status
    // guard + one-tx finalize). Under the cutover rule (workflow active ⇒ awc levels off)
    // these run their zero-step branch = direct apply. Already-decided answers are the
    // idempotent no-op signal, swallowed here per the integration guide.
    const approve = notice.outcome === 'approved';
    const remarks = notice.remarks ?? (approve ? 'Approved via approval workflow' : 'Returned via approval workflow');
    try {
      if (notice.scope.screenId.endsWith('-cr')) {
        const cr = (await db().select({ id: changeRequest.id }).from(changeRequest)
          .where(eq(changeRequest.cruuid, notice.subjectRef)).limit(1))[0];
        if (!cr) throw new AppError(404, `[approvals] CR ${notice.subjectRef} not found for onDecision`);
        const crService = await import('../change-requests/services/changeRequestsService');
        if (approve) await crService.approveChangeRequest(cr.id, { comment: remarks, reviewerId: notice.decidedBy, role: 'Office' });
        else await crService.rejectChangeRequest(cr.id, { comment: remarks, reviewerId: notice.decidedBy, role: 'Office' });
      } else {
        const wo = (await db().select({ id: workOrders.id }).from(workOrders)
          .where(eq(workOrders.wouuid, notice.subjectRef)).limit(1))[0];
        if (!wo) throw new AppError(404, `[approvals] WO ${notice.subjectRef} not found for onDecision`);
        const woService = await import('../work-orders/services/workOrderService');
        const body = { approvedBy: notice.decidedBy, approvalRemarks: remarks, userUuid: notice.decidedBy, role: 'Office' };
        if (notice.scope.screenId === 'pms-wo-re-postponement') {
          if (approve) await woService.approveRePostponement(wo.id, body);
          else await woService.rejectRePostponement(wo.id, body);
        } else {
          if (approve) await woService.approvePostponement(wo.id, body);
          else await woService.rejectPostponement(wo.id, body);
        }
      }
    } catch (e: any) {
      // Idempotency: a replayed onDecision hits the module's own decide-once/status guards.
      const msg = String(e?.message ?? e);
      if (e?.statusCode === 409 || /already|Only work orders with status/i.test(msg)) {
        console.log(`[approvals] onDecision no-op (already applied): ${notice.scope.screenId} ${notice.subjectRef}`);
        return;
      }
      throw e;
    }
  },
};

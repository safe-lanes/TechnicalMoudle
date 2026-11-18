/**
 * 18-Nov-2026 — "Job's Office Reviewers": a special approver for the approval engine.
 *
 * In Admin → Approval Workflow a step can name this special approver instead of a fixed role.
 * When a request is submitted, the engine (card.expandSlot) replaces it with the roles ticked in
 * the work order's Job (jobs.office_reviewer_role_ruids), one approval box per role, and uses the
 * Job's rule (jobs.office_reviewer_rule): 'any' = Any one (OR, default), 'all' = All (AND).
 * Each box is then resolved like any role (vessel-scoped, resolveRoleApproverUserIds).
 *
 * Used by "Work Order Office Review" (pms-wo-office-review) and, later, form approvals
 * (Jeevan's Form Integration plan, Stage 4), which follow the same Job roles and rule.
 */
import { eq, inArray, or } from 'drizzle-orm';
import type { RoleSlotDef, SlotExpansion } from '../approval-engine';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { admnRoleMaster, jobs, workOrders } from '@shared/schema';
import { normalizeOfficeReviewerRoles, normalizeOfficeReviewerRule } from '@shared/officeReviewer';

export const JOB_OFFICE_REVIEWERS_ROLE = 'job:office-reviewers';
export const JOB_OFFICE_REVIEWERS_LABEL = "Job's Office Reviewers";
export const OFFICE_REVIEW_SCREEN = 'pms-wo-office-review';
export const OFFICE_REVIEW_CLASSIFICATION = 'Office Review';

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

export interface JobOfficeReviewConfig {
  jobRef: string;
  roleIds: string[];
  rule: 'any' | 'all';
}

/** The office review configuration of a work order's Job, or null when the WO/Job is not found. */
export async function officeReviewConfigForWorkOrder(woUuid: string): Promise<JobOfficeReviewConfig | null> {
  const wo = (await db().select({ jobId: workOrders.jobId }).from(workOrders).where(eq(workOrders.wouuid, woUuid)).limit(1))[0];
  if (!wo?.jobId) return null;
  const job = (await db()
    .select({ juuid: jobs.juuid, roles: jobs.officeReviewerRoleRuids, rule: jobs.officeReviewerRule })
    .from(jobs)
    .where(or(eq(jobs.juuid, wo.jobId), eq(jobs.id, wo.jobId)))
    .limit(1))[0];
  if (!job) return null;
  return { jobRef: job.juuid, roleIds: normalizeOfficeReviewerRoles(job.roles), rule: normalizeOfficeReviewerRule(job.rule) };
}

/**
 * The engine expansion for a work order: one slot per Job role (labels from Access Control,
 * deleted roles left out) and the Job's AND/OR. Empty slots when the Job has no usable role; the
 * engine then refuses the submit (EMPTY_SLOT_EXPANSION) and the caller keeps today's behaviour.
 */
export async function jobOfficeReviewersExpansion(woUuid: string): Promise<SlotExpansion> {
  const cfg = await officeReviewConfigForWorkOrder(woUuid);
  if (!cfg || cfg.roleIds.length === 0) return { slots: [] };
  const roles = await db()
    .select({ ruid: admnRoleMaster.ruid, name: admnRoleMaster.assignedRole, isDeleted: admnRoleMaster.isDeleted })
    .from(admnRoleMaster)
    .where(inArray(admnRoleMaster.ruid, cfg.roleIds));
  const byId = new Map(roles.filter((r) => !r.isDeleted).map((r) => [r.ruid, r.name]));
  const slots: RoleSlotDef[] = cfg.roleIds
    .filter((id) => byId.has(id))
    .map((id) => ({ roleId: id, roleLabel: byId.get(id) as string }));
  return { slots, quorum: { rule: cfg.rule } };
}

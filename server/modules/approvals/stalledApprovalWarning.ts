/**
 * Stalled-approval warning (25-Sep-2026, Sahil E5 / Q7: "tell Sail Admin after 24 hours").
 *
 * An approval step whose every active slot resolved to ZERO approvers can never move: nobody gets
 * the button, nobody is notified. Once such a step has waited STALLED_APPROVAL_WARN_MS (default
 * 24 h) every Sail Admin gets ONE in-app notification (+ email when configured) per request and
 * step, naming the action, the subject and the roles with nobody assigned. The fix is an
 * assignment in SAILERP ("My Vessels") or a chain change; the Sail Admin zero-approver override
 * remains the in-app way to decide it.
 *
 * Shore-only: runs inside the hourly ApprovalEmailRetryScheduler tick, per tenant. Read-only
 * against the engine (listPendingEngineRequests); writes only approval_notifications rows.
 * The step's start time is approximated as the latest decision on the request (or submission
 * when nothing was decided yet) — the engine stores no per-step activation time.
 */
import { and, eq } from 'drizzle-orm';
import { masterUsers } from '@shared/schema';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { approvalNotifications } from './notificationSchema';
import { listPendingEngineRequests } from './engineGateway';
import { notifyUsers, subjectLine } from './approvalNotifier';

const DEFAULT_WARN_MS = 24 * 60 * 60 * 1000;
const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

export interface StalledCandidate {
  requuid: string;
  nodeKey: string;
  stalledSince: Date;
  roleLabels: string[];
}

type SlotLike = { nodeKey: string; status: string; roleLabel: string; resolvedApproverIds: string[] | null; decidedAt: string | null };

/** Pure: pending requests whose active step has nobody to approve and is older than warnMs. */
export function findStalledSteps(
  requests: Array<{ requuid: string; submittedAt: string; slots: SlotLike[] }>,
  now: Date,
  warnMs: number,
): StalledCandidate[] {
  const out: StalledCandidate[] = [];
  for (const r of requests) {
    const active = r.slots.filter((s) => s.status === 'active');
    if (active.length === 0) continue;
    if (!active.every((s) => (s.resolvedApproverIds ?? []).length === 0)) continue;
    const decided = r.slots
      .map((s) => (s.decidedAt ? Date.parse(s.decidedAt) : NaN))
      .filter((t) => !Number.isNaN(t));
    const since = new Date(decided.length ? Math.max(...decided) : Date.parse(r.submittedAt));
    if (Number.isNaN(since.getTime()) || now.getTime() - since.getTime() < warnMs) continue;
    out.push({
      requuid: r.requuid,
      nodeKey: active[0].nodeKey,
      stalledSince: since,
      roleLabels: Array.from(new Set(active.map((s) => s.roleLabel))),
    });
  }
  return out;
}

export async function runStalledApprovalWarningPass(now = new Date()): Promise<{ warned: number }> {
  const warnMs = parseInt(process.env.STALLED_APPROVAL_WARN_MS || '', 10) || DEFAULT_WARN_MS;
  const pending = await listPendingEngineRequests();
  const stalled = findStalledSteps(pending, now, warnMs);
  if (stalled.length === 0) return { warned: 0 };
  const admins = (await db().select({ id: masterUsers.id }).from(masterUsers)
    .where(and(eq(masterUsers.role, 'Sail Admin'), eq(masterUsers.isDeleted, false)))).map((u) => u.id);
  if (admins.length === 0) {
    console.warn(`[approvals] ${stalled.length} approval step(s) stalled with nobody to approve — no Sail Admin user to warn`);
    return { warned: 0 };
  }
  let warned = 0;
  for (const s of stalled) {
    const req = pending.find((p) => p.requuid === s.requuid);
    if (!req) continue;
    // One warning per request + step: the title carries the step key.
    const title = `Approval waiting with nobody to approve (step ${s.nodeKey})`;
    const already = await db().select({ id: approvalNotifications.id }).from(approvalNotifications)
      .where(and(
        eq(approvalNotifications.requuid, s.requuid),
        eq(approvalNotifications.kind, 'stalled-no-approver'),
        eq(approvalNotifications.title, title),
      ))
      .limit(1);
    if (already.length > 0) continue;
    const subject = await subjectLine(req.scope, req.subjectRef, req.vesselId);
    const hours = Math.floor((now.getTime() - s.stalledSince.getTime()) / 3_600_000);
    const forVessel = req.vesselId ? ' for this vessel' : '';
    await notifyUsers(admins, {
      requuid: s.requuid, scope: req.scope, subjectRef: req.subjectRef, vesselId: req.vesselId,
      kind: 'stalled-no-approver', title,
      message: `${subject}: this approval has waited ${hours} hours because nobody is assigned the role(s) `
        + `${s.roleLabels.join(', ')}${forVessel}. Assign an approver in SAILERP (My Vessels), `
        + 'or decide it with the Sail Admin override.',
    });
    warned++;
  }
  return { warned };
}

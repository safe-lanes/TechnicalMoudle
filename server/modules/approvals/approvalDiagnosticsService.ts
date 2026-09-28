/**
 * Shared approval diagnostics — Technical + cross-module checks (28-Sep-2026, Sahil C3/C4/C5).
 * Read-only. Plain-language problems only, one instruction per group (same style as Sahil's
 * Defects panel, which keeps its own Defects-specific checks).
 *
 *  1. blockedActions       — an action (Technical + Defects) with no active chain for a
 *                            classification, or switched off: since the old Level 1/2 ticks were
 *                            retired these submissions are REFUSED.
 *  2. rolesWithoutApprover — Technical chains: a role in an active chain that nobody holds for a
 *                            vessel (moc pools are fleet-wide: an empty pool blocks every vessel).
 *  3. stalled              — waiting requests (any module) whose active step has nobody to approve.
 *  4. failedUpdates        — the engine finished a request, but the Change Request / WO / defect is
 *                            still waiting (the module update failed; nothing retries it). Each row
 *                            carries the request id for "Apply again". A request finished less than
 *                            FAILED_UPDATE_GRACE_MS ago is not reported (normal hand-over).
 */
import {
  engineWorkflowMatrix, engineActiveWorkflowNodes, listPendingEngineRequests, approvalRequestsInScopes,
  isApprovalEngineAvailable, scopeFor, getEngineRequest, replayEngineDecision,
} from './engineGateway';
import { resolveRoleApproverUserIds, resolveApproverNames, MOC_POOL_ROLE_L1, MOC_POOL_ROLE_L2 } from './approvalCard';
import { findStalledSteps } from './stalledApprovalWarning';
import { subjectLine } from './approvalNotifier';
import * as repo from './approvalDiagnosticsRepository';
import { classifyChangeRequestScope } from '../change-requests/services/changeRequestsService';
import { AppError } from '../shared/errors';
import type { RequestRow } from '../approval-engine';

const FAILED_UPDATE_GRACE_MS = 2 * 60 * 1000;
const DEFECT_EXTENSION_SCOPES = ['defects-extension', 'defects-repeat-extension'];

export interface DiagnosticRow { text: string; detail?: string; requuid?: string; moduleId?: string }
export interface DiagnosticGroup { key: string; title: string; consequence: string; instruction: string; rows: DiagnosticRow[] }
export interface ApprovalDiagnostics { generatedAt: string; available: boolean; healthy: boolean; groups: DiagnosticGroup[] }

type Req = Pick<RequestRow, 'requuid' | 'status' | 'submittedAt' | 'finalizedAt' | 'scope'>;

/** Pure: the newest request of a subject is finished (and not just now) while the subject still waits. */
export function isFailedUpdate<T extends Req>(requests: T[], now: Date, graceMs = FAILED_UPDATE_GRACE_MS): T | null {
  if (requests.length === 0) return null;
  const latest = [...requests].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
  if (latest.status !== 'approved' && latest.status !== 'returned') return null;
  const finished = latest.finalizedAt ? Date.parse(latest.finalizedAt) : NaN;
  if (!Number.isNaN(finished) && now.getTime() - finished < graceMs) return null;
  return latest;
}

const outcomeText = (s: string) => (s === 'approved' ? 'approved' : 'rejected / returned');

export async function getApprovalDiagnostics(now = new Date()): Promise<ApprovalDiagnostics> {
  const generatedAt = now.toISOString();
  if (!isApprovalEngineAvailable()) {
    return { generatedAt, available: false, healthy: false, groups: [] };
  }
  const vessels = await repo.listActiveVessels();

  // 1. blocked actions
  const blocked: DiagnosticRow[] = [];
  const matrices = { technical: await engineWorkflowMatrix('technical'), defects: await engineWorkflowMatrix('defects') };
  for (const [moduleId, matrix] of Object.entries(matrices)) {
    for (const m of matrix) {
      if (m.enabled && m.active) continue;
      // Repeat extension falls back to the first-extension chain — only a gap when that is missing too.
      if (m.screenId === 'defects-repeat-extension' && m.enabled
        && matrix.some((x) => x.screenId === 'defects-extension' && x.classification === m.classification && x.enabled && x.active)) continue;
      blocked.push({ moduleId, text: `${m.label} — ${m.classification}`, detail: m.enabled ? 'no approval chain set up' : 'switched off' });
    }
  }

  // 2. Technical roles nobody holds (per vessel; moc pools fleet-wide)
  const roleGaps = new Map<string, { label: string; actions: Set<string>; vessels: Set<string>; pool: boolean }>();
  for (const m of matrices.technical.filter((x) => x.enabled && x.active)) {
    const wf = await engineActiveWorkflowNodes('technical', m.screenId, m.classification);
    for (const node of wf?.nodes ?? []) {
      for (const slot of node.slots ?? []) {
        const key = slot.roleId;
        const isPool = key === MOC_POOL_ROLE_L1 || key === MOC_POOL_ROLE_L2;
        const gap = roleGaps.get(key) ?? { label: slot.roleLabel, actions: new Set<string>(), vessels: new Set<string>(), pool: isPool };
        if (isPool) {
          if ((await resolveApproverNames(key)).names.length === 0) { gap.actions.add(`${m.label} — ${m.classification}`); }
        } else {
          let any = false;
          for (const v of vessels) {
            if ((await resolveRoleApproverUserIds(key, v.vuuid)).length === 0) { gap.vessels.add(v.name); any = true; }
          }
          if (any) gap.actions.add(`${m.label} — ${m.classification}`);
        }
        if (gap.actions.size > 0) roleGaps.set(key, gap);
      }
    }
  }
  const roleRows: DiagnosticRow[] = Array.from(roleGaps.values()).map((g) => ({
    moduleId: 'technical',
    text: g.pool ? `${g.label}: the approver pool is empty (every vessel)` : `${g.label}: nobody assigned on ${Array.from(g.vessels).sort().join(', ')}`,
    detail: `Used in: ${Array.from(g.actions).sort().join('; ')}`,
  }));

  // 3. stalled — any module
  const pending = await listPendingEngineRequests();
  const stalledRows: DiagnosticRow[] = [];
  for (const s of findStalledSteps(pending, now, 0)) {
    const r = pending.find((p) => p.requuid === s.requuid)!;
    stalledRows.push({
      moduleId: r.scope.moduleId, requuid: r.requuid,
      text: await subjectLine(r.scope, r.subjectRef, r.vesselId),
      detail: `Waiting since ${s.stalledSince.toISOString().slice(0, 10)} — nobody holds ${s.roleLabels.join(', ')}`,
    });
  }

  // 4. failed updates — Technical CRs, WO (re-)postponements, Defects extension / verification
  const failed: DiagnosticRow[] = [];
  const addFailed = async (moduleId: string, scopes: string[], subjectRef: string, vesselId: string | null, what: string) => {
    const reqs = await approvalRequestsInScopes(scopes.map((sc) => scopeFor(moduleId, sc)), subjectRef);
    const hit = isFailedUpdate(reqs, now);
    if (!hit) return;
    failed.push({
      moduleId, requuid: hit.requuid,
      text: await subjectLine(hit.scope, subjectRef, vesselId),
      detail: `${what}: the approval was ${outcomeText(hit.status)} but the record was not updated`,
    });
  };
  for (const cr of await repo.listSubmittedChangeRequests()) {
    const cls = await classifyChangeRequestScope(cr);
    if (cls.functionId) await addFailed('technical', [cls.functionId], cr.cruuid, cr.vesselId ?? null, 'Change request');
  }
  for (const wo of await repo.listWorkOrdersAwaitingApproval()) {
    await addFailed('technical', ['pms-wo-postponement', 'pms-wo-re-postponement'], wo.wouuid, wo.vesselId ?? null, 'WO postponement');
  }
  for (const d of await repo.listOpenApprovalDefects()) {
    const entries: unknown[] = Array.isArray(d.targetDateExtensions) ? d.targetDateExtensions : [];
    const hasRequested = entries.some((e) => typeof e === 'object' && e !== null && (e as { status?: unknown }).status === 'Requested');
    if (hasRequested) await addFailed('defects', DEFECT_EXTENSION_SCOPES, d.duuid, d.vesselId ?? null, 'Defect extension');
    if (d.confirmCompleted === true && d.verified !== true) await addFailed('defects', ['defects-verification'], d.duuid, d.vesselId ?? null, 'Defect verification');
  }

  const groups: DiagnosticGroup[] = [
    { key: 'blockedActions', title: 'Approval actions that cannot be submitted', rows: blocked,
      consequence: 'Requests for these actions are refused on shore (ship requests wait on shore) until a chain exists.',
      instruction: 'Select the action in the tree and set up its approval chain, or switch it on.' },
    { key: 'rolesWithoutApprover', title: 'Approval roles nobody holds', rows: roleRows,
      consequence: 'A request reaching this step will wait with nobody able to approve it.',
      instruction: 'Assign the role to a person for these vessels in SAILERP (My Vessels), or change the chain.' },
    { key: 'stalled', title: 'Approvals waiting with nobody able to approve them', rows: stalledRows,
      consequence: 'These requests cannot move. Sail Admin is warned after 24 hours.',
      instruction: 'Assign an approver in SAILERP, or decide it with the Sail Admin override.' },
    { key: 'failedUpdates', title: 'Approvals finished but the record was not updated', rows: failed,
      consequence: 'The approval shows as decided, but the change request, work order or defect still waits.',
      instruction: 'Press "Apply again". If it fails again, contact support with the request details.' },
  ].filter((g) => g.rows.length > 0);
  return { generatedAt, available: true, healthy: groups.length === 0, groups };
}

/** "Apply again" — re-deliver a finished request's decision to its module. */
export async function reapplyApprovalDecision(requuid: string, actorUserId: string | null) {
  const req = await getEngineRequest(requuid);
  if (!req) throw new AppError(404, 'Approval request not found.');
  return replayEngineDecision(requuid, actorUserId);
}

/** Which module a request belongs to (for the permission check before "Apply again"). */
export async function moduleOfRequest(requuid: string): Promise<string | null> {
  return (await getEngineRequest(requuid))?.scope.moduleId ?? null;
}

/**
 * Phase 2 follow-up (Sahil, 21-Aug-2026: notifications = BOTH in-app + email).
 *
 * On engine events this notifier now:
 *   1. writes per-user IN-APP rows (approval_notifications, migration 171) — approvers whose
 *      turn it is on step-activated; the submitter on completed/returned,
 *   2. sends EMAIL via AWS SES (04-Sep-2026 — sesEmailTransport.ts, the Audit module's
 *      proven approach; the old SMTP/noon-report path was never configured anywhere).
 *      Env not configured → email_status 'skipped' (in-app still delivered).
 *      APPROVAL_SMTP_JSON=1 keeps the pilot/test mode (send path runs, logs JSON, no AWS),
 *   3. still logs structured lines + writes the audit_log event rows (unchanged).
 * Everything is fire-and-forget: a notification or email failure never breaks or blocks
 * an approval — in-app delivery happens regardless of email state.
 */
import { eq, inArray } from 'drizzle-orm';
import type { EngineEvent, Scope } from '../approval-engine';
import { storage } from '../../storage';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { approvalNotifications } from './notificationSchema';
import { masterUsers, vessels, changeRequest, workOrders } from '@shared/schema';
import { sesEmailConfig, sendApprovalEmail, type SesEmailConfig } from './sesEmailTransport';

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

const SCREEN_LABEL: Record<string, string> = {
  'pms-components-cr': 'Component Change Request',
  'pms-jobs-cr': 'Job Change Request',
  'pms-spares-cr': 'Spare Change Request',
  'pms-stores-cr': 'Store Change Request',
  'pms-wo-postponement': 'Work Order Postponement',
  'pms-wo-re-postponement': 'Work Order Re-Postponement',
  'defects-extension': 'Defect Target Date Extension',
  'defects-verification': 'Defect Verification',
};
const label = (s: Scope) => SCREEN_LABEL[s.screenId] ?? `${s.moduleId}/${s.screenId}`;

/**
 * F4: reports whether approval EMAIL is configured, so an admin can see when approvers are
 * getting in-app notifications only (the admin-page banner). Mirrors sesEmailConfig()'s
 * guard exactly (does not send).
 */
export function emailConfigStatus(): { configured: boolean; mode: 'live' | 'json-test' | 'unconfigured'; from: string | null } {
  const cfg = sesEmailConfig();
  if (!cfg) return { configured: false, mode: 'unconfigured', from: null };
  return { configured: true, mode: cfg.mode, from: cfg.from };
}

async function subjectLine(scope: Scope, subjectRef: string, vesselId: string | null): Promise<string> {
  let name = '';
  try {
    if (scope.screenId.endsWith('-cr')) {
      const r = (await db().select({ t: changeRequest.title }).from(changeRequest).where(eq(changeRequest.cruuid, subjectRef)).limit(1))[0];
      name = r?.t ?? subjectRef;
    } else if (scope.moduleId === 'defects') {
      const { defects } = await import('@shared/schema');
      const r = (await db().select({ id: defects.id, d: defects.description }).from(defects).where(eq(defects.duuid, subjectRef)).limit(1))[0];
      name = r ? `${r.id} — ${String(r.d ?? '').slice(0, 80)}` : subjectRef;
    } else {
      const r = (await db().select({ no: workOrders.workOrderNo, jt: workOrders.jobTitle }).from(workOrders).where(eq(workOrders.wouuid, subjectRef)).limit(1))[0];
      name = r ? `${r.no} — ${r.jt}` : subjectRef;
    }
    if (vesselId) {
      const v = (await db().select({ n: vessels.name }).from(vessels).where(eq(vessels.vuuid, vesselId)).limit(1))[0];
      if (v?.n) name += ` (${v.n})`;
    }
  } catch { name = subjectRef; }
  return name;
}

/** Insert in-app rows + email the recipients. Returns nothing; logs + stores email status. */
async function notifyUsers(userIds: string[], base: {
  requuid: string; scope: Scope; subjectRef: string; vesselId: string | null;
  kind: 'pending-approval' | 'approved' | 'returned'; title: string; message: string;
}): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return;
  const sesCfg: SesEmailConfig | null = sesEmailConfig();
  const emails = await db().select({ id: masterUsers.id, email: masterUsers.email, name: masterUsers.fullName })
    .from(masterUsers).where(inArray(masterUsers.id, unique));
  const emailByUser = new Map(emails.map((e) => [e.id, e.email]));

  for (const userUuid of unique) {
    let emailStatus: string | null = null;
    let emailError: string | null = null;
    const to = emailByUser.get(userUuid);
    if (!sesCfg) {
      emailStatus = 'skipped'; // SES env not configured — in-app only (admin banner shows this)
    } else if (!to) {
      emailStatus = 'skipped'; emailError = 'no email on master_users';
    } else {
      try {
        // Sequential + paced + retried inside the transport; permanent SES errors
        // surface immediately. A failure lands here and ONLY here — the in-app row
        // below is written regardless.
        await sendApprovalEmail(sesCfg, to, base.title, base.message);
        emailStatus = 'sent';
      } catch (e: any) {
        emailStatus = 'error'; emailError = String(e?.message ?? e).slice(0, 300);
        console.error(`[approvals] email to ${to} failed:`, e?.message ?? e);
      }
    }
    await db().insert(approvalNotifications).values({
      userUuid, requuid: base.requuid,
      moduleId: base.scope.moduleId, screenId: base.scope.screenId, actionId: base.scope.actionId,
      subjectRef: base.subjectRef, vesselId: base.vesselId,
      kind: base.kind, title: base.title, message: base.message,
      emailStatus, emailError,
    });
  }
  console.log(`[approvals] NOTIFY ${base.kind} → ${unique.length} user(s) [email: ${!sesCfg ? 'skipped (SES not configured)' : `attempted via SES (${sesCfg.mode})`}] ${base.title}`);
}

async function auditRow(actionType: string, evt: { requuid: string; subjectRef: string; scope: Scope }, payload: Record<string, unknown>): Promise<void> {
  try {
    await storage.createAuditLog({
      entityType: 'approval_request', entityId: evt.requuid, actionType,
      userId: 'approval-engine', source: 'approval-engine',
      payload: { scope: evt.scope, subjectRef: evt.subjectRef, ...payload },
    } as any);
  } catch (e) { console.error('[approvals] notifier audit row failed:', e); }
}

/** Submitter + vessel of a request via the engine's public API (modules never read apprv_*). */
async function requestInfo(tenantId: string, scope: Scope, subjectRef: string, requuid: string): Promise<{ submittedBy: string | null; vesselId: string | null }> {
  try {
    const { getTechnicalEngine } = await import('./engineGateway');
    const engine = getTechnicalEngine();
    if (!engine) return { submittedBy: null, vesselId: null };
    const rows = await engine.status({ tenantId, actor: { userId: 'notifier', role: null, userType: null } }, scope, subjectRef);
    const r = rows.find((x) => x.requuid === requuid);
    return { submittedBy: r?.submittedBy ?? null, vesselId: r?.vesselId ?? null };
  } catch { return { submittedBy: null, vesselId: null }; }
}

export function approvalEventNotifier(evt: EngineEvent): void {
  void (async () => {
    try {
      if (evt.type === 'step-activated') {
        const info = await requestInfo(evt.tenantId, evt.scope, evt.subjectRef, evt.requuid);
        const subject = await subjectLine(evt.scope, evt.subjectRef, info.vesselId);
        await notifyUsers(evt.approverUserIds, {
          requuid: evt.requuid, scope: evt.scope, subjectRef: evt.subjectRef, vesselId: info.vesselId,
          kind: 'pending-approval',
          title: `Approval required: ${label(evt.scope)} — ${subject}`,
          message: `A ${label(evt.scope).toLowerCase()} is waiting for your approval.\n\n${subject}\n\nOpen the PMS Technical module to review and approve or reject.`,
        });
        await auditRow('approval_step_activated', evt, { nodeKey: evt.nodeKey, approverUserIds: evt.approverUserIds, tenantId: evt.tenantId });
      } else if (evt.type === 'request-completed') {
        const info = await requestInfo(evt.tenantId, evt.scope, evt.subjectRef, evt.requuid);
        const subject = await subjectLine(evt.scope, evt.subjectRef, info.vesselId);
        if (info.submittedBy) {
          await notifyUsers([info.submittedBy], {
            requuid: evt.requuid, scope: evt.scope, subjectRef: evt.subjectRef, vesselId: info.vesselId,
            kind: 'approved',
            title: `Approved: ${label(evt.scope)} — ${subject}`,
            message: `Your ${label(evt.scope).toLowerCase()} has been fully approved and applied.\n\n${subject}`,
          });
        }
        await auditRow('approval_request_completed', evt, { tenantId: evt.tenantId });
      } else if (evt.type === 'request-returned') {
        const info = await requestInfo(evt.tenantId, evt.scope, evt.subjectRef, evt.requuid);
        const subject = await subjectLine(evt.scope, evt.subjectRef, info.vesselId);
        if (info.submittedBy) {
          await notifyUsers([info.submittedBy], {
            requuid: evt.requuid, scope: evt.scope, subjectRef: evt.subjectRef, vesselId: info.vesselId,
            kind: 'returned',
            title: `Returned: ${label(evt.scope)} — ${subject}`,
            message: `Your ${label(evt.scope).toLowerCase()} was returned by ${evt.returnedBy}.${evt.remarks ? `\n\nRemarks: ${evt.remarks}` : ''}\n\n${subject}`,
          });
        }
        await auditRow('approval_request_returned', evt, { returnedBy: evt.returnedBy, remarks: evt.remarks, tenantId: evt.tenantId });
      }
    } catch (e) {
      console.error('[approvals] notifier failed (approval unaffected):', e);
    }
  })();
}

/**
 * Phase 2 follow-up (Sahil, 21-Aug-2026: notifications = BOTH in-app + email via AWS SES).
 *
 * On engine events this notifier now:
 *   1. writes per-user IN-APP rows (approval_notifications, migration 171) — approvers whose
 *      turn it is on step-activated; the submitter on completed/returned,
 *   2. sends EMAIL through the same SES SMTP transport pattern Technical already uses
 *      (noon-report mailer): APPROVAL_SMTP_HOST/PORT/USER/PASS/FROM, falling back to the
 *      existing NR_SMTP_* values so ops configures SES once. Not configured → email_status
 *      'skipped' (in-app still delivered). APPROVAL_SMTP_JSON=1 = nodemailer jsonTransport
 *      (pilot/test proof of the send path without real SES credentials),
 *   3. still logs structured lines + writes the audit_log event rows (unchanged).
 * Everything is fire-and-forget: a notification failure never breaks an approval.
 */
import { eq, inArray } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import type { EngineEvent, Scope } from '../approval-engine';
import { storage } from '../../storage';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { approvalNotifications } from './notificationSchema';
import { masterUsers, vessels, changeRequest, workOrders } from '@shared/schema';

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
};
const label = (s: Scope) => SCREEN_LABEL[s.screenId] ?? `${s.moduleId}/${s.screenId}`;

// ── email transport (SES SMTP — same pattern/envs family as the noon-report mailer) ─────────
function createTransport(): { t: nodemailer.Transporter; from: string } | 'skipped' {
  if (process.env.APPROVAL_SMTP_JSON === '1') {
    return { t: nodemailer.createTransport({ jsonTransport: true }), from: process.env.APPROVAL_SMTP_FROM || 'approvals@test.local' };
  }
  const host = process.env.APPROVAL_SMTP_HOST || process.env.NR_SMTP_HOST;
  const port = parseInt(process.env.APPROVAL_SMTP_PORT || process.env.NR_SMTP_PORT || '587');
  const user = process.env.APPROVAL_SMTP_USER || process.env.NR_SMTP_USER;
  const pass = process.env.APPROVAL_SMTP_PASS || process.env.NR_SMTP_PASS;
  const from = process.env.APPROVAL_SMTP_FROM || process.env.NR_SMTP_FROM || user;
  if (!host || !user || !pass || !from) return 'skipped';
  return { t: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }), from };
}

/**
 * F4: reports whether approval EMAIL is configured, so an admin can see when approvers are
 * getting in-app notifications only. Mirrors createTransport()'s guard exactly (does not send).
 */
export function emailConfigStatus(): { configured: boolean; mode: 'live' | 'json-test' | 'unconfigured'; from: string | null } {
  if (process.env.APPROVAL_SMTP_JSON === '1') {
    return { configured: true, mode: 'json-test', from: process.env.APPROVAL_SMTP_FROM || 'approvals@test.local' };
  }
  const host = process.env.APPROVAL_SMTP_HOST || process.env.NR_SMTP_HOST;
  const user = process.env.APPROVAL_SMTP_USER || process.env.NR_SMTP_USER;
  const pass = process.env.APPROVAL_SMTP_PASS || process.env.NR_SMTP_PASS;
  const from = process.env.APPROVAL_SMTP_FROM || process.env.NR_SMTP_FROM || user || null;
  const configured = !!(host && user && pass && from);
  return { configured, mode: configured ? 'live' : 'unconfigured', from: configured ? from : null };
}

async function subjectLine(scope: Scope, subjectRef: string, vesselId: string | null): Promise<string> {
  let name = '';
  try {
    if (scope.screenId.endsWith('-cr')) {
      const r = (await db().select({ t: changeRequest.title }).from(changeRequest).where(eq(changeRequest.cruuid, subjectRef)).limit(1))[0];
      name = r?.t ?? subjectRef;
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
  const transport = createTransport();
  const emails = await db().select({ id: masterUsers.id, email: masterUsers.email, name: masterUsers.fullName })
    .from(masterUsers).where(inArray(masterUsers.id, unique));
  const emailByUser = new Map(emails.map((e) => [e.id, e.email]));

  for (const userUuid of unique) {
    let emailStatus: string | null = null;
    let emailError: string | null = null;
    const to = emailByUser.get(userUuid);
    if (transport === 'skipped') {
      emailStatus = 'skipped';
    } else if (!to) {
      emailStatus = 'skipped'; emailError = 'no email on master_users';
    } else {
      try {
        await transport.t.sendMail({ from: transport.from, to, subject: base.title, text: base.message });
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
  console.log(`[approvals] NOTIFY ${base.kind} → ${unique.length} user(s) [email: ${transport === 'skipped' ? 'skipped (SMTP not configured)' : 'attempted'}] ${base.title}`);
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

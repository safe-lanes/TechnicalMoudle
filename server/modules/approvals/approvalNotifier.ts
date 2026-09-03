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
import { masterUsers, vessels, changeRequest, workOrders, companyApprovalSettings } from '@shared/schema';
import { sesEmailConfig, sendApprovalEmail, isValidEmailAddress, type SesEmailConfig } from './sesEmailTransport';

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
 * Per-tenant admin toggle for approval EMAIL (mig 172, company_approval_settings.
 * approval_email_enabled — that table is IN ACTIVE USE for this flag even though its
 * legacy superintendent-lock column is retired). Missing row/column reads as ON, and any
 * read failure defaults ON — the toggle can never block or delay an approval.
 */
export async function approvalEmailToggleEnabled(): Promise<boolean> {
  try {
    const row = (await db().select({ enabled: companyApprovalSettings.approvalEmailEnabled })
      .from(companyApprovalSettings).limit(1))[0];
    return row?.enabled !== false; // missing row = ON (default)
  } catch {
    return true; // pre-migration DB or transient error — default ON, never break notify
  }
}

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
  // Admin toggle (per tenant). Only consulted when SES is configured — unconfigured stays
  // 'skipped' so the two states are never confused. OFF → no SES call is made at all.
  const toggleOn = sesCfg ? await approvalEmailToggleEnabled() : true;
  const emails = await db().select({ id: masterUsers.id, email: masterUsers.email, name: masterUsers.fullName })
    .from(masterUsers).where(inArray(masterUsers.id, unique));
  const emailByUser = new Map(emails.map((e) => [e.id, e.email]));

  for (const userUuid of unique) {
    // ── IN-APP FIRST (audit fix 1a, 04-Sep-2026) ────────────────────────────────
    // The in-app row is the guaranteed delivery and must never wait on an SES round
    // trip. Rows that WILL attempt email are inserted as 'queued' and updated to
    // sent/error right after the attempt — so a crash mid-batch leaves a durable
    // 'queued' row the hourly retry sweep picks up (nothing is silently lost).
    const to = emailByUser.get(userUuid);
    let emailStatus: string;
    let emailError: string | null = null;
    if (!sesCfg) {
      emailStatus = 'skipped'; // SES env not configured — in-app only (admin banner shows this)
    } else if (!toggleOn) {
      emailStatus = 'disabled'; // admin switched email off — distinct from skipped/error
    } else if (!to) {
      emailStatus = 'skipped'; emailError = 'no email on master_users';
    } else if (!isValidEmailAddress(to)) {
      emailStatus = 'invalid-address'; emailError = 'address failed syntax validation — never sent'; // never reaches SES
    } else {
      emailStatus = 'queued';
    }
    let anuuid: string | null = null;
    try {
      const inserted = await db().insert(approvalNotifications).values({
        userUuid, requuid: base.requuid,
        moduleId: base.scope.moduleId, screenId: base.scope.screenId, actionId: base.scope.actionId,
        subjectRef: base.subjectRef, vesselId: base.vesselId,
        kind: base.kind, title: base.title, message: base.message,
        emailStatus, emailError,
      }).returning({ anuuid: approvalNotifications.anuuid });
      anuuid = inserted[0]?.anuuid ?? null;
    } catch (e) {
      console.error('[approvals] in-app notification insert failed:', e);
      continue; // no row → nothing to email either
    }

    if (emailStatus !== 'queued' || !sesCfg || !to) continue;
    try {
      // Sequential + paced + retried inside the transport; permanent SES errors
      // surface immediately. Failures land HERE only — the in-app row already exists.
      const messageId = await sendApprovalEmail(sesCfg, to, base.title, base.message);
      await db().update(approvalNotifications)
        .set({ emailStatus: 'sent', emailError: null })
        .where(eq(approvalNotifications.anuuid, anuuid!));
      console.log(`[approvals] email sent anuuid=${anuuid} sesMessageId=${messageId}`);
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 300);
      await db().update(approvalNotifications)
        .set({ emailStatus: 'error', emailError: msg })
        .where(eq(approvalNotifications.anuuid, anuuid!))
        .catch((u: unknown) => console.error('[approvals] email status update failed:', u));
      console.error(`[approvals] email failed anuuid=${anuuid} to=${to}: ${msg}`);
    }
  }
  console.log(`[approvals] NOTIFY ${base.kind} → ${unique.length} user(s) [email: ${!sesCfg ? 'skipped (SES not configured)' : !toggleOn ? 'disabled by admin toggle' : `attempted via SES (${sesCfg.mode})`}] ${base.title}`);
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

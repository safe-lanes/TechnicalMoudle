/**
 * Approval email RETRY sweep — SHORE-ONLY (audit hardening, 04-Sep-2026).
 *
 * Closes the durability gap: a transient send failure used to be 3 in-process attempts
 * then a permanent 'error'. The approval_notifications row already holds everything
 * needed to resend (user, title, message), so this hourly sweep re-drives it:
 *
 *   - picks rows with email_status='error' (transient failure) or a STALE 'queued'
 *     (crash mid-batch — older than QUEUED_STALE_MS so it never races the notifier),
 *   - WINDOWED bounds instead of an attempt column (product decision, option (a),
 *     04-Sep-2026): rows are retried only within RETRY_WINDOW_MS of creation — at the
 *     hourly cadence that is ≤ ~24 attempts — after which they are finalised to
 *     'failed' (a visible permanent failure beats an indefinite retry). No migration.
 *   - re-reads the user's CURRENT address (it may have been fixed), validates it
 *     ('invalid-address' if not, never touching SES), sends via the same paced/backoff
 *     transport, and updates the row IMMEDIATELY after each send.
 *
 * AT-LEAST-ONCE, stated plainly: if the process dies between SES accepting a send and
 * the row update, the next pass resends that one email. The update-immediately-per-row
 * design makes that window seconds wide. A rare duplicate notification email is
 * accepted; a lost one is not.
 *
 * Pattern copied from shipskartReconcilerScheduler (shore-only guard, boot delay +
 * interval + in-progress guard, env-tunable, registered in routes.ts and
 * stopAllSchedulers). Tenant iteration copied from maintenanceOrchestrator
 * (getActiveTenants + runInTenantContext) so every tenant's failed emails retry.
 * Nothing here can block or delay an approval — it only ever touches its own rows.
 */
import { and, eq, inArray, lt, gt, sql } from 'drizzle-orm';
import { isShipInstance } from '../sync/syncRole';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { tenantConnectionManager } from '../../utils/tenantConnectionManager';
import { approvalNotifications } from './notificationSchema';
import { masterUsers } from '@shared/schema';
import { sesEmailConfig, sendApprovalEmail, isValidEmailAddress } from './sesEmailTransport';
import { approvalEmailToggleEnabled } from './approvalNotifier';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;   // hourly (accepted cadence)
const DEFAULT_BOOT_DELAY_MS = 5 * 60 * 1000;  // let migrations/boot settle first
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;  // retry ≤24h from creation, then final 'failed'
const QUEUED_STALE_MS = 10 * 60 * 1000;       // 'queued' younger than this belongs to a live batch
const DEFAULT_BATCH = 200;                    // bound one pass; the next hour takes the rest

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

export interface RetryPassSummary { finalised: number; resent: number; invalid: number; stillFailing: number; skipped: string | null }

/** One pass for the CURRENT tenant context. Exported for the harness. */
export async function runApprovalEmailRetryPass(batch = DEFAULT_BATCH): Promise<RetryPassSummary> {
  const summary: RetryPassSummary = { finalised: 0, resent: 0, invalid: 0, stillFailing: 0, skipped: null };
  const now = Date.now();
  const windowStart = new Date(now - RETRY_WINDOW_MS);
  const queuedCutoff = new Date(now - QUEUED_STALE_MS);

  // 1. Finalise expired rows regardless of config/toggle — a visible permanent failure.
  const expired = await db().update(approvalNotifications)
    .set({ emailStatus: 'failed', emailError: sql`COALESCE(${approvalNotifications.emailError}, '') || ' [retry window expired]'` })
    .where(and(inArray(approvalNotifications.emailStatus, ['error', 'queued']), lt(approvalNotifications.createdAt, windowStart)))
    .returning({ anuuid: approvalNotifications.anuuid });
  summary.finalised = expired.length;
  for (const r of expired) console.log(`[ApprovalEmailRetry] anuuid=${r.anuuid} finalised 'failed' (24h retry window expired)`);

  // 2. Retry only when email can actually send right now.
  const cfg = sesEmailConfig();
  if (!cfg) { summary.skipped = 'SES not configured'; return summary; }
  if (!(await approvalEmailToggleEnabled())) { summary.skipped = 'admin toggle OFF'; return summary; }

  const rows = await db().select({
    anuuid: approvalNotifications.anuuid, userUuid: approvalNotifications.userUuid,
    title: approvalNotifications.title, message: approvalNotifications.message,
    emailStatus: approvalNotifications.emailStatus, createdAt: approvalNotifications.createdAt,
  }).from(approvalNotifications)
    .where(and(
      gt(approvalNotifications.createdAt, windowStart),
      sql`(${approvalNotifications.emailStatus} = 'error' OR (${approvalNotifications.emailStatus} = 'queued' AND ${approvalNotifications.createdAt} < ${queuedCutoff}))`,
    ))
    .limit(batch);
  if (rows.length === 0) return summary;

  // Fresh addresses — the profile may have been corrected since the failure.
  const userIds = Array.from(new Set(rows.map((r) => r.userUuid)));
  const users = await db().select({ id: masterUsers.id, email: masterUsers.email })
    .from(masterUsers).where(inArray(masterUsers.id, userIds));
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));

  for (const row of rows) {
    const to = emailByUser.get(row.userUuid);
    if (!to || !isValidEmailAddress(to)) {
      await db().update(approvalNotifications)
        .set({ emailStatus: 'invalid-address', emailError: to ? 'address failed syntax validation — never sent' : 'no email on master_users' })
        .where(eq(approvalNotifications.anuuid, row.anuuid));
      summary.invalid++;
      continue; // never reaches SES
    }
    try {
      const messageId = await sendApprovalEmail(cfg, to, row.title, row.message);
      // Update IMMEDIATELY per row — narrows the at-least-once window to seconds.
      await db().update(approvalNotifications)
        .set({ emailStatus: 'sent', emailError: null })
        .where(eq(approvalNotifications.anuuid, row.anuuid));
      summary.resent++;
      console.log(`[ApprovalEmailRetry] anuuid=${row.anuuid} RESENT sesMessageId=${messageId}`);
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 300);
      await db().update(approvalNotifications)
        .set({ emailStatus: 'error', emailError: msg })
        .where(eq(approvalNotifications.anuuid, row.anuuid))
        .catch((u: unknown) => console.error('[ApprovalEmailRetry] status update failed:', u));
      summary.stillFailing++;
      console.warn(`[ApprovalEmailRetry] anuuid=${row.anuuid} still failing: ${msg}`);
    }
  }
  return summary;
}

export class ApprovalEmailRetryScheduler {
  private timer: NodeJS.Timeout | null = null;
  private bootTimer: NodeJS.Timeout | null = null;
  private inProgress = false;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    if (await isShipInstance()) {
      console.log('[ApprovalEmailRetry] Ship instance — scheduler NOT started (approval email is shore-only)');
      return;
    }
    const intervalMs = parseInt(process.env.APPROVAL_EMAIL_RETRY_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL_MS;
    const bootDelayMs = parseInt(process.env.APPROVAL_EMAIL_RETRY_BOOT_DELAY_MS || '', 10) || DEFAULT_BOOT_DELAY_MS;
    const batch = parseInt(process.env.APPROVAL_EMAIL_RETRY_BATCH || '', 10) || DEFAULT_BATCH;
    this.bootTimer = setTimeout(() => { void this.tick(batch); }, bootDelayMs);
    this.timer = setInterval(() => { void this.tick(batch); }, intervalMs);
    this.started = true;
    console.log(`[ApprovalEmailRetry] Shore instance — scheduler started (every ${Math.round(intervalMs / 60000)}min, first run in ${Math.round(bootDelayMs / 60000)}min, batch ${batch}).`);
  }

  private async tick(batch: number): Promise<void> {
    if (this.inProgress) {
      console.log('[ApprovalEmailRetry] previous pass still running — skipping this tick');
      return;
    }
    this.inProgress = true;
    try {
      if (await isShipInstance()) return; // role can flip at runtime (RoleWatchdog discipline)
      if (!tenantConnectionManager.isMultiTenantEnabled) {
        const s = await runApprovalEmailRetryPass(batch);
        this.log('single', s);
        return;
      }
      const tenants = await tenantConnectionManager.getActiveTenants();
      for (const t of tenants) {
        const s = await tenantConnectionManager.runInTenantContext(t.tuid, () => runApprovalEmailRetryPass(batch));
        this.log(t.tuid, s);
      }
    } catch (err: any) {
      // Never let email retry take anything down.
      console.error(`[ApprovalEmailRetry] pass failed: ${err?.message || err}`);
    } finally {
      this.inProgress = false;
    }
  }

  private log(tenant: string, s: RetryPassSummary): void {
    if (s.skipped) {
      if (s.finalised > 0) console.log(`[ApprovalEmailRetry] ${tenant}: finalised=${s.finalised}, retry skipped (${s.skipped})`);
      return; // quiet when there is nothing to say
    }
    if (s.finalised || s.resent || s.invalid || s.stillFailing) {
      console.log(`[ApprovalEmailRetry] ${tenant}: resent=${s.resent} stillFailing=${s.stillFailing} invalid=${s.invalid} finalised=${s.finalised}`);
    }
  }

  stop(): void {
    if (this.bootTimer) { clearTimeout(this.bootTimer); this.bootTimer = null; }
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.started = false;
    console.log('[ApprovalEmailRetry] Scheduler stopped');
  }

  isStarted(): boolean { return this.started; }
}

export const approvalEmailRetryScheduler = new ApprovalEmailRetryScheduler();

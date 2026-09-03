/**
 * Approval notifications inbox API (Sahil: in-app + email — this is the in-app read side).
 * Rows are written shore-side by the notifier; on ships the table is empty (engine shore-only),
 * so these routes answer empty lists there — the bell stays quiet, nothing breaks.
 * Identity = the authenticated request's userUuid (forwarded x-user-id); users only ever see
 * and mutate their OWN rows.
 */
import { Router } from 'express';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { asyncHandler } from '../shared/middleware';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { requireRole } from '../../middleware/auth';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';
import { approvalNotifications } from './notificationSchema';
import { companyApprovalSettings } from '@shared/schema';
import { emailConfigStatus, approvalEmailToggleEnabled } from './approvalNotifier';
import { resolveApproverNames } from './approvalCard';
import { isVesselScopeStrict } from './vesselScopeFlag';

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};
const me = (req: AuthenticatedRequest): string => req.user?.userUuid ?? 'anonymous';

const router = Router();

// GET /approvals/config — client-readable runtime flags for the approval gates.
// vesselScopeStrict drives the client read-only gate (and mirrors the server resolver);
// read on every surface so "flag off restores current behaviour" holds end to end.
router.get('/approvals/config', asyncHandler(async (_req, res) => {
  res.json({ vesselScopeStrict: isVesselScopeStrict() });
}));

// GET /approvals/notifications?unread=1 — newest first, capped
router.get('/approvals/notifications', asyncHandler(async (req, res) => {
  const userUuid = me(req as AuthenticatedRequest);
  const unreadOnly = String(req.query.unread ?? '') === '1';
  const where = unreadOnly
    ? and(eq(approvalNotifications.userUuid, userUuid), isNull(approvalNotifications.readAt))
    : eq(approvalNotifications.userUuid, userUuid);
  const rows = await db().select().from(approvalNotifications).where(where)
    .orderBy(desc(approvalNotifications.createdAt)).limit(50);
  res.json(rows);
}));

// GET /approvals/role-approvers?roleId=<ruid|moc:Level N> — F7: resolved approver NAMES for the
// admin read-only "View configured approvers" panel. Office-only (same audience as the builder).
router.get('/approvals/role-approvers', requireRole(['PMS Admin', 'Sail Admin', 'Super Admin']), asyncHandler(async (req, res) => {
  const roleId = String(req.query.roleId ?? '');
  if (!roleId) return void res.status(400).json({ error: 'roleId required' });
  res.json(await resolveApproverNames(roleId));
}));

// GET /approvals/email-config — F4: admin-visible email delivery status (no secrets exposed).
// Lets the Approval Engine admin screen show "email not configured — in-app only" instead of a
// silent no-email. Does not send anything; mirrors the notifier's transport guard.
// Also carries the per-tenant admin toggle state (mig 172) for the switch beside the banner.
router.get('/approvals/email-config', asyncHandler(async (_req, res) => {
  res.json({ ...emailConfigStatus(), emailEnabled: await approvalEmailToggleEnabled() });
}));

// PUT /approvals/email-config — the admin ON/OFF toggle for approval emails (mig 172).
// Per tenant (each tenant DB holds its own company_approval_settings singleton — a table
// IN ACTIVE USE for this flag; its legacy superintendent-lock column is retired). Guarded
// like every other approval config write. In-app notifications are never affected; with
// the toggle OFF the notifier records email_status='disabled' and makes no SES call.
router.put('/approvals/email-config',
  requireRole(['PMS Admin', 'Sail Admin', 'Super Admin']),
  asyncHandler(async (req, res) => {
    const enabled = (req.body as { enabled?: unknown })?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Body must be { enabled: boolean }' });
    }
    const actor = (req as AuthenticatedRequest).user?.userUuid ?? null;
    const existing = (await db().select({ id: companyApprovalSettings.id }).from(companyApprovalSettings).limit(1))[0];
    if (existing) {
      await db().update(companyApprovalSettings)
        .set({ approvalEmailEnabled: enabled, updatedBy: actor, updatedAt: new Date() })
        .where(eq(companyApprovalSettings.id, existing.id));
    } else {
      // Insert keeps every other column at its default — the retired lock column is untouched.
      await db().insert(companyApprovalSettings).values({ singletonKey: 'ACTIVE', approvalEmailEnabled: enabled, updatedBy: actor });
    }
    res.json({ ...emailConfigStatus(), emailEnabled: enabled });
  }));

// GET /approvals/notifications/count — unread badge
router.get('/approvals/notifications/count', asyncHandler(async (req, res) => {
  const userUuid = me(req as AuthenticatedRequest);
  const rows = await db().select({ id: approvalNotifications.id }).from(approvalNotifications)
    .where(and(eq(approvalNotifications.userUuid, userUuid), isNull(approvalNotifications.readAt)));
  res.json({ count: rows.length });
}));

// PATCH /approvals/notifications/:anuuid/read — own rows only
router.patch('/approvals/notifications/:anuuid/read', asyncHandler(async (req, res) => {
  const userUuid = me(req as AuthenticatedRequest);
  const updated = await db().update(approvalNotifications).set({ readAt: new Date() })
    .where(and(eq(approvalNotifications.anuuid, req.params.anuuid), eq(approvalNotifications.userUuid, userUuid), isNull(approvalNotifications.readAt)))
    .returning({ anuuid: approvalNotifications.anuuid });
  res.json({ success: true, updated: updated.length });
}));

// POST /approvals/notifications/read-all
router.post('/approvals/notifications/read-all', asyncHandler(async (req, res) => {
  const userUuid = me(req as AuthenticatedRequest);
  const updated = await db().update(approvalNotifications).set({ readAt: new Date() })
    .where(and(eq(approvalNotifications.userUuid, userUuid), isNull(approvalNotifications.readAt)))
    .returning({ anuuid: approvalNotifications.anuuid });
  res.json({ success: true, updated: updated.length });
}));

export default router;

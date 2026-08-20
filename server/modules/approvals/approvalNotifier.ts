/**
 * Phase 2 / W1 — thin notifier for engine events.
 *
 * ⚠️ DEVIATION, FLAGGED (see PHASE2-REPORT): the brief assumed an existing in-app
 * notification surface + an SES path Technical already uses for approvals. Neither exists:
 * the validation report already found CR/postponement approvals fire NO notifications today
 * (net-new surface), `alert_events` requires a NOT NULL alert_policies FK we cannot seed
 * without a migration (zero-migration rule), and the only mailer is the noon-report SMTP
 * transport (report-shaped, module-internal). What this notifier therefore does today:
 *   1. structured log lines (operations can grep them),
 *   2. a persistent, queryable audit_log row per event via the EXISTING audit trail
 *      (storage.createAuditLog — the one in-app row surface that fits without schema change),
 *   3. a single seam (`deliver`) where the real transport (alert policy row + SES) plugs in
 *      once the product decides it.
 */
import type { EngineEvent } from '../approval-engine';
import { storage } from '../../storage';

async function auditRow(actionType: string, evt: { requuid: string; subjectRef: string; scope: { moduleId: string; screenId: string; actionId: string } }, payload: Record<string, unknown>): Promise<void> {
  try {
    await storage.createAuditLog({
      entityType: 'approval_request',
      entityId: evt.requuid,
      actionType,
      userId: 'approval-engine',
      source: 'approval-engine',
      payload: { scope: evt.scope, subjectRef: evt.subjectRef, ...payload },
    } as any);
  } catch (e) {
    console.error('[approvals] notifier audit row failed (event not lost — logged above):', e);
  }
}

/** The transport seam. Today: log only. */
function deliver(kind: string, recipients: string[], summary: string): void {
  console.log(`[approvals] NOTIFY ${kind} → [${recipients.join(', ')}] ${summary}`);
}

export function approvalEventNotifier(evt: EngineEvent): void {
  void (async () => {
    if (evt.type === 'step-activated') {
      deliver('pending-approval', evt.approverUserIds, `${evt.scope.screenId} ${evt.subjectRef} awaits step ${evt.nodeKey}`);
      await auditRow('approval_step_activated', evt, { nodeKey: evt.nodeKey, approverUserIds: evt.approverUserIds, tenantId: evt.tenantId });
    } else if (evt.type === 'request-completed') {
      deliver('approved', [], `${evt.scope.screenId} ${evt.subjectRef} fully approved`);
      await auditRow('approval_request_completed', evt, { tenantId: evt.tenantId });
    } else if (evt.type === 'request-returned') {
      deliver('returned', [], `${evt.scope.screenId} ${evt.subjectRef} returned by ${evt.returnedBy}`);
      await auditRow('approval_request_returned', evt, { returnedBy: evt.returnedBy, remarks: evt.remarks, tenantId: evt.tenantId });
    }
  })();
}

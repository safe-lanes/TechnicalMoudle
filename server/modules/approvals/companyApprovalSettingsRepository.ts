/**
 * company_approval_settings — the per-tenant approval settings singleton (ONE_WAY shore → ship).
 * 25-Sep-2026 (Sahil E4): the approval-email toggle write moved here from the route (routes must
 * not hold raw DB writes). Sahil's note that this write "bypasses logFieldChanges" does NOT make
 * it a sync defect — PROVEN on the pilot: logFieldChanges is a deliberate no-op for every
 * non-BOTH_EDITABLE table (fieldLogger.requiresFieldLogging); ONE_WAY tables reach ships as full
 * rows selected by updated_at, which this write sets. So no field-log call is made here.
 */
import { eq } from 'drizzle-orm';
import { companyApprovalSettings } from '@shared/schema';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

export async function setApprovalEmailEnabled(enabled: boolean, actor: string | null): Promise<void> {
  const before = (await db().select({ id: companyApprovalSettings.id }).from(companyApprovalSettings).limit(1))[0];
  if (before) {
    await db().update(companyApprovalSettings)
      .set({ approvalEmailEnabled: enabled, updatedBy: actor, updatedAt: new Date() }) // updated_at drives ONE_WAY delivery
      .where(eq(companyApprovalSettings.id, before.id));
  } else {
    // Insert keeps every other column at its default — the retired lock column is untouched.
    await db().insert(companyApprovalSettings)
      .values({ singletonKey: 'ACTIVE', approvalEmailEnabled: enabled, updatedBy: actor });
  }
}

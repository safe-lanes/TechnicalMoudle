/**
 * Read-only data for the shared approval diagnostics (28-Sep-2026, Sahil C3/C4/C5).
 * Only the module records that can still be waiting on an approval decision are read here; the
 * engine's own state is read through engineGateway (never apprv_* directly).
 */
import { and, eq } from 'drizzle-orm';
import { changeRequest, workOrders, defects, vessels } from '@shared/schema';
import { getPostgresClient } from '../../postgresClient';
import { getCurrentTenantContext } from '../../utils/asyncLocalStorage';

const db = () => {
  const ctx = getCurrentTenantContext();
  return ctx ? ctx.db : getPostgresClient().db;
};

/** Change requests still 'submitted' (waiting for an approval decision). */
export async function listSubmittedChangeRequests() {
  return db().select({
    id: changeRequest.id, cruuid: changeRequest.cruuid, title: changeRequest.title,
    targetType: changeRequest.targetType, targetId: changeRequest.targetId, vesselId: changeRequest.vesselId,
  }).from(changeRequest).where(eq(changeRequest.status, 'submitted'));
}

/** Work orders still 'Awaiting Office Approval' (postponement or re-postponement). */
export async function listWorkOrdersAwaitingApproval() {
  return db().select({
    id: workOrders.id, wouuid: workOrders.wouuid, workOrderNo: workOrders.workOrderNo,
    jobTitle: workOrders.jobTitle, vesselId: workOrders.vesselId,
  }).from(workOrders).where(eq(workOrders.status, 'Awaiting Office Approval'));
}

/** Defects that can still be waiting on an extension or verification decision. */
export async function listOpenApprovalDefects() {
  const rows = await db().select({
    id: defects.id, duuid: defects.duuid, description: defects.description, vesselId: defects.vesselId,
    targetDateExtensions: defects.targetDateExtensions, confirmCompleted: defects.confirmCompleted,
    verified: defects.verified, isDeleted: defects.isDeleted,
  }).from(defects);
  return rows.filter((r) => r.isDeleted !== true);
}

export async function listActiveVessels() {
  return db().select({ vuuid: vessels.vuuid, name: vessels.name })
    .from(vessels).where(and(eq(vessels.isActive, true), eq(vessels.isDeleted, false)));
}

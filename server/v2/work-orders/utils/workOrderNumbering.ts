import { getDb } from "../../../db";
import { v2WorkOrders as workOrders, v2Jobs as jobs } from "@shared/v2/work-orders/schema";
import { eq } from "drizzle-orm";

const TASK_TYPE_CODES: Record<string, string> = {
  'Inspection': 'IN',
  'Service': 'SE',
  'Overhaul': 'OV',
  'Calibration': 'CA',
  'Test': 'TE',
  'Replacement': 'RE',
  'Cleaning': 'CL',
  'Lubrication': 'LU',
  'General': 'GN'
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function generatePlannedWorkOrderNumber(
  jobCode: string,
  componentCode: string,
  vesselId?: string
): Promise<string> {
  const currentYear = new Date().getFullYear();

  if (!componentCode || !componentCode.trim()) {
    throw new Error('Component code is required for planned work order numbering');
  }

  const safeJobCode = jobCode && jobCode.trim() ? jobCode.trim() : 'UNKNOWN-JOB';
  const safeComponentCode = componentCode.trim();

  const db = await getDb();
  const allWorkOrders = vesselId
    ? await db.select().from(workOrders).where(eq(workOrders.vesselId, vesselId))
    : await db.select().from(workOrders);

  const plannedPattern = new RegExp(`^${escapeRegex(safeJobCode)}-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`);
  let maxRunningNumber = 0;
  for (const wo of allWorkOrders) {
    const match = wo.workOrderNo.match(plannedPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) maxRunningNumber = num;
    }
  }

  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, '0');
  return `${safeJobCode}-${safeComponentCode}-${currentYear}-${paddedNumber}`;
}

export async function generateUnplannedWorkOrderNumber(
  vesselId: string,
  componentCode: string
): Promise<string> {
  const currentYear = new Date().getFullYear();

  if (!componentCode || !componentCode.trim()) {
    throw new Error('Component code is required for unplanned work order numbering');
  }

  const safeComponentCode = componentCode.trim();

  const db = await getDb();
  const allWorkOrders = await db.select().from(workOrders).where(eq(workOrders.vesselId, vesselId));

  const unplannedPattern = new RegExp(`^UWO-${escapeRegex(safeComponentCode)}-${currentYear}-(\\d+)$`);
  let maxRunningNumber = 0;
  for (const wo of allWorkOrders) {
    const match = wo.workOrderNo.match(unplannedPattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxRunningNumber) maxRunningNumber = num;
    }
  }

  const nextRunningNumber = maxRunningNumber + 1;
  const paddedNumber = nextRunningNumber.toString().padStart(3, '0');
  return `UWO-${safeComponentCode}-${currentYear}-${paddedNumber}`;
}

export function generateWorkOrderNumber(): string {
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `WO-${randomDigits}`;
}

export function generateExecutionId(): string {
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `WOE-${randomDigits}`;
}

export function determineWorkOrderType(jobId?: string | null, templateCode?: string | null): 'Planned' | 'Unplanned' {
  return (jobId || templateCode) ? 'Planned' : 'Unplanned';
}

const BLOCKING_STATUSES_EXACT = new Set([
  'active',
  'due',
  'due (grace p)',
  'due (grace)',
  'overdue',
  'pending approval',
  'pending_approval',
  'pendingapproval',
  'postponed',
  'in progress',
  'in_progress',
  'inprogress',
  'open',
  'rejected',
]);

export function isBlockingStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return BLOCKING_STATUSES_EXACT.has(status.toLowerCase().trim());
}

export function isCompletedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'completed' || s === 'closed' || s === 'approved' || s === 'cancelled' || s === 'canceled';
}

export function isJobCritical(job: any): boolean {
  const priority = (job.jobPriority || '').toLowerCase();
  return priority === 'critical' || priority === 'high';
}

export function extractJobNoFromWorkOrderNo(workOrderNo: string | undefined): string | null {
  if (!workOrderNo) return null;

  const newFormatMatch = workOrderNo.match(/^(.+?)-\d+\.\d+.*-\d{4}-\d+$/);
  if (newFormatMatch) return newFormatMatch[1];

  const woSuffixMatch = workOrderNo.match(/^(.+?)\.WO-\d{4}-\d+$/);
  if (woSuffixMatch) return woSuffixMatch[1];

  const oldFormatMatch = workOrderNo.match(/^(.+)-\d{4}-\d+$/);
  if (oldFormatMatch) return oldFormatMatch[1];

  return null;
}

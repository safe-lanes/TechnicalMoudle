import { z } from 'zod';
import { WORK_ORDER_TABS, type WorkOrderApprovalTierCounts } from './utils/workOrderFilters';

// Shared contract for database-paged Work Order reads and complete-scope APIs.
export const WORK_ORDER_SORT_FIELDS = [
  'component', 'workOrderNo', 'jobTitle', 'assignedTo', 'dueDate', 'status',
  'dateCompleted', 'plannedDate', 'postponeUntil', 'postponementReason',
  'daysLate', 'approvalTier',
] as const;

const positiveInteger = z.union([
  z.number(),
  z.string().regex(/^\d+$/).transform(Number),
]).pipe(z.number().int().positive().safe());

const year = z.number().int().min(1).max(9999);
const transportDate = z.string().min(1).max(100).superRefine((value, ctx) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid period date' });
    return;
  }
  // Native Date silently rolls 2026-02-30 into March. Reject malformed day-only
  // transport values, rather than silently changing the requested period.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(timestamp).toISOString().slice(0, 10) !== value)
    ctx.addIssue({ code: 'custom', message: 'Invalid period date' });
});

export const workOrderPeriodQuery = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('year-only'), year }),
  z.object({ mode: z.literal('year-quarter'), year, quarter: z.number().int().min(1).max(4) }),
  z.object({
    mode: z.literal('year-months'), year,
    // Do not deduplicate: existing RH filtering counts repeated months.
    months: z.array(z.number().int().min(1).max(12)).min(1).max(12),
  }),
  z.object({ mode: z.literal('date-range'), dateFrom: transportDate, dateTo: transportDate }),
]).superRefine((period, ctx) => {
  if (period.mode === 'date-range' && Date.parse(period.dateFrom) > Date.parse(period.dateTo))
    ctx.addIssue({ code: 'custom', path: ['dateTo'], message: 'Reversed period date range' });
});

const encodedPeriod = z.string().max(4000).transform((value, ctx) => {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; }
  catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid period JSON' });
    return z.NEVER;
  }
}).pipe(workOrderPeriodQuery.nullable());

const criticality = z.string().max(200).default('').transform(value =>
  value.split(',').filter(Boolean),
).pipe(z.array(z.enum(['critical', 'non-critical', 'critical-component'])));

const timeZone = z.string().min(1).max(100).refine(value => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
  catch { return false; }
}, 'Invalid period timezone');

export const workOrderPageQuery = z.object({
  page: positiveInteger.default(1),
  // Preserve the existing maximum, including clamping requests above it.
  pageSize: positiveInteger.default(10).transform(size => Math.min(200, size)),
  vesselId: z.string().min(1).max(200).default('all'),
  // Undefined means no client narrowing; "" explicitly means no vessels.
  vesselIds: z.string().max(12000).optional(),
  scope: z.enum(['all', 'my']).optional(),
  // Legacy callers without this field retain server-local period semantics.
  // The Work Orders screen always sends the initiating browser's IANA zone.
  timeZone: timeZone.default(Intl.DateTimeFormat().resolvedOptions().timeZone),
  status: z.enum(WORK_ORDER_TABS).default('Planned'),
  search: z.string().max(2000).default(''),
  period: encodedPeriod.optional().transform(value => value ?? null),
  rank: z.string().max(500).default(''),
  criticality,
  postponementReason: z.string().max(2000).default(''),
  sortBy: z.enum(WORK_ORDER_SORT_FIELDS).optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
}).strict().superRefine((query, ctx) => {
  if (!Number.isSafeInteger((query.page - 1) * query.pageSize))
    ctx.addIssue({ code: 'custom', path: ['page'], message: 'Page offset is too large' });
  if (query.vesselId === 'my')
    ctx.addIssue({ code: 'custom', path: ['vesselId'], message: 'Use scope=my with vesselId=all' });
});

export type WorkOrderPageQuery = z.infer<typeof workOrderPageQuery>;

export interface WorkOrderPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<string, number>;
  approvalTierCounts: WorkOrderApprovalTierCounts;
  rankOptions: string[];
}

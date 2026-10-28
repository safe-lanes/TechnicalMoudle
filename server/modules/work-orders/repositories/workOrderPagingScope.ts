import { and, eq, sql, type SQL } from 'drizzle-orm';
import { masterUserVessels } from '@shared/schema';
import type { WorkOrderPageQuery } from '@shared/workOrdersPagination';
import type { AuthenticatedRequest, RbacIdentity } from '../../../middleware/auth';
import { getDb } from '../../../db';

/** Null is authorized Office fleet scope; [] is an intentionally empty scope. */
export interface WorkOrderReadScope {
  readonly vesselIds: readonly string[] | null;
}

type ScopeQuery = Pick<WorkOrderPageQuery, 'vesselId' | 'vesselIds' | 'scope'>;

function forbidden(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 403 });
}

/** Pure intersection shared by all proposed paged/queue/export operations.
 * Only server-loaded active assignments may be supplied as trustedAssignments.
 */
export function intersectWorkOrderScope(
  identity: RbacIdentity | undefined,
  query: ScopeQuery,
  trustedAssignments: readonly string[],
): WorkOrderReadScope {
  const ship = identity?.userType === 'Ship';
  const office = identity?.userType === 'Office';
  if (!ship && !office) forbidden('A trusted Office or Ship identity is required');

  const requested = query.vesselIds === undefined
    ? undefined
    : Array.from(new Set(query.vesselIds.split(',').filter(Boolean)));
  // Existing Work Orders clients send vesselIds for My Vessels without scope.
  // Treat that shape as restricted as well; a supplied list is never authority.
  const restricted = ship || query.scope === 'my' || requested !== undefined;
  let vessels: string[] | null = restricted
    ? Array.from(new Set(trustedAssignments.filter(Boolean)))
    : null;

  if (requested !== undefined) {
    const allowed = new Set(vessels ?? []);
    vessels = requested.filter(id => allowed.has(id));
  }

  if (query.vesselId !== 'all') {
    if (ship && !trustedAssignments.includes(query.vesselId))
      forbidden('Vessel is not assigned to this user');
    vessels = vessels === null
      ? [query.vesselId]
      : vessels.filter(id => id === query.vesselId);
  }
  return { vesselIds: vessels };
}

export async function resolveWorkOrderReadScope(
  req: Pick<AuthenticatedRequest, 'user' | 'rbac'>,
  query: ScopeQuery,
): Promise<WorkOrderReadScope> {
  const identity = req.rbac;
  if (!identity || !['Ship', 'Office'].includes(identity.userType ?? ''))
    forbidden('A trusted Office or Ship identity is required');
  const needsAssignments = identity.userType === 'Ship'
    || query.scope === 'my' || query.vesselIds !== undefined;
  // Do not query with a missing identity; most importantly, do not fall back
  // from unresolved My Vessels to Office fleet access.
  if (!needsAssignments) return intersectWorkOrderScope(identity, query, []);
  if (!req.user?.userUuid) return intersectWorkOrderScope(identity, query, []);

  const db = await getDb();
  const assignments = await db.select({ vesselId: masterUserVessels.vesselId })
    .from(masterUserVessels).where(and(
      eq(masterUserVessels.userUuid, req.user.userUuid),
      eq(masterUserVessels.isActive, true),
    ));
  return intersectWorkOrderScope(identity, query, assignments.map(row => row.vesselId));
}

/** Fixed alias only. Never interpolate client column/alias names into SQL. */
export function workOrderScopePredicate(scope: WorkOrderReadScope): SQL {
  if (scope.vesselIds === null) return sql`TRUE`;
  if (scope.vesselIds.length === 0) return sql`FALSE`;
  return sql`w.vessel_id IN (${sql.join(scope.vesselIds.map(id => sql`${id}`), sql`,`)})`;
}

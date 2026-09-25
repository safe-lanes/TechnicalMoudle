/**
 * Server-side user lookup for the assistant token mint (Option B, 25-Sep-2026).
 *
 * PROVEN on dev (25-Sep): the genuine SAILERP login token carries `id` and `userType` but NO `role`; the role
 * lives only in the browser profile. The mint must not trust browser headers, so the role is resolved from the
 * tenant's synced SAILERP master data (`master_users`, fed by the master-data import) by the VERIFIED user id.
 * getDb() resolves to the current tenant's database (tenant context set by tenantMiddleware).
 */
import { and, eq } from 'drizzle-orm';
import { masterUsers } from '@shared/schema';
import { getDb } from '../../db';

export interface MasterUserIdentity {
  role: string | null;
  userType: 'Office' | 'Ship' | null;
}

export async function findMasterUserById(userId: string): Promise<MasterUserIdentity | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ role: masterUsers.role, userType: masterUsers.userType })
    .from(masterUsers)
    .where(and(eq(masterUsers.id, userId), eq(masterUsers.isDeleted, false)))
    .limit(1);
  if (!rows.length) return null;
  const ut = (rows[0].userType || '').trim();
  return {
    role: (rows[0].role || '').trim() || null,
    userType: ut === 'Office' || ut === 'Ship' ? ut : null,
  };
}

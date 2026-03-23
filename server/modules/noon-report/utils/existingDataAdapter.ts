// ====== NOON REPORT MODULE — Existing Data Adapter ======
// This is the ONLY file in this module permitted to read from existing tables.
// Read-only access only. No writes to existing tables.

import { db } from '../../../db';
import { vessels, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export async function getVesselById(vesselId: string) {
  const result = await db.select({
    vuuid: vessels.vuuid,
    name: vessels.name,
    imoNumber: vessels.imoNumber,
    flag: vessels.flag,
    vesselType: vessels.vesselType,
  }).from(vessels).where(eq(vessels.vuuid, vesselId)).limit(1);
  return result[0] ?? null;
}

/**
 * Fetch the deadweight tonnage (DWT) for a vessel using a raw SQL query.
 * The `deadweight` column exists in the `vessels` table in the database
 * but is not declared in the Drizzle schema to avoid modifying shared/schema.ts.
 * Returns null if the vessel is not found or DWT is not configured.
 */
export async function getVesselDwt(vesselId: string): Promise<number | null> {
  type DwtRow = { deadweight: string | null };
  const result = await db.execute(
    sql`SELECT deadweight FROM vessels WHERE vuuid = ${vesselId} LIMIT 1`
  );
  const row = (result.rows as DwtRow[])[0] ?? null;
  if (!row?.deadweight) return null;
  const n = Number(row.deadweight);
  return isNaN(n) || n <= 0 ? null : n;
}

export async function getAllVessels() {
  return db.select({
    vuuid: vessels.vuuid,
    name: vessels.name,
    imoNumber: vessels.imoNumber,
    flag: vessels.flag,
    vesselType: vessels.vesselType,
  }).from(vessels).orderBy(vessels.name);
}

export async function getUserById(userId: string) {
  const numericId = parseInt(userId, 10);
  if (isNaN(numericId)) return null;
  const result = await db.select({
    id: users.id,
    username: users.username,
    fullName: users.fullName,
    role: users.role,
    vesselId: users.vesselId,
  }).from(users).where(eq(users.id, numericId)).limit(1);
  return result[0] ?? null;
}

// ====== NOON REPORT MODULE — Existing Data Adapter ======
// This is the ONLY file in this module permitted to read from existing tables.
// Read-only access only. No writes to existing tables.
//
// NOTE: `deadweight` and `gross_tonnage` exist in the live `vessels` table
// (added via ALTER TABLE) but are not in shared/schema.ts (scope isolation).
// We access them via raw SQL template queries parameterised through Drizzle's
// sql`` helper — safe from injection.

import { db } from '../../../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

type VesselRow = {
  vuuid: string;
  name: string;
  imo_number: string | null;
  flag: string | null;
  vessel_type: string | null;
  deadweight: string | null;
  gross_tonnage: string | null;
};

export async function getVesselById(vesselId: string): Promise<{
  vuuid: string;
  name: string;
  imoNumber: string | null;
  flag: string | null;
  vesselType: string | null;
  deadweight: number | null;
  grossTonnage: number | null;
} | null> {
  const result = await db.execute(
    sql`SELECT vuuid, name, imo_number, flag, vessel_type, deadweight, gross_tonnage
        FROM vessels WHERE vuuid = ${vesselId} LIMIT 1`
  );
  const row = (result.rows as VesselRow[])[0] ?? null;
  if (!row) return null;
  const dwt = row.deadweight ? Number(row.deadweight) : null;
  const gt = row.gross_tonnage ? Number(row.gross_tonnage) : null;
  return {
    vuuid: row.vuuid,
    name: row.name,
    imoNumber: row.imo_number,
    flag: row.flag,
    vesselType: row.vessel_type,
    deadweight: dwt !== null && !isNaN(dwt) && dwt > 0 ? dwt : null,
    grossTonnage: gt !== null && !isNaN(gt) && gt > 0 ? gt : null,
  };
}

/**
 * Convenience helper: returns just the DWT for a vessel.
 * Delegates to getVesselById so the two are always consistent.
 */
export async function getVesselDwt(vesselId: string): Promise<number | null> {
  const vessel = await getVesselById(vesselId);
  return vessel?.deadweight ?? null;
}

type AllVesselRow = {
  vuuid: string;
  name: string;
  imo_number: string | null;
  flag: string | null;
  vessel_type: string | null;
};

export async function getAllVessels() {
  const result = await db.execute(
    sql`SELECT vuuid, name, imo_number, flag, vessel_type FROM vessels ORDER BY name`
  );
  return (result.rows as AllVesselRow[]).map(row => ({
    vuuid: row.vuuid,
    name: row.name,
    imoNumber: row.imo_number,
    flag: row.flag,
    vesselType: row.vessel_type,
  }));
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

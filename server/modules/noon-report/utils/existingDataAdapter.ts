// ====== NOON REPORT MODULE — Existing Data Adapter ======
// This is the ONLY file in this module permitted to read from existing tables.
// Read-only access only. No writes to existing tables.

import { db } from '../../../db';
import { vessels, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function getVesselById(vesselId: string) {
  const result = await db.select({
    vuuid: vessels.vuuid,
    name: vessels.name,
    imoNumber: vessels.imoNumber,
    flag: vessels.flag,
    vesselType: vessels.vesselType,
    deadweight: vessels.deadweight,
    grossTonnage: vessels.grossTonnage,
  }).from(vessels).where(eq(vessels.vuuid, vesselId)).limit(1);
  return result[0] ?? null;
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

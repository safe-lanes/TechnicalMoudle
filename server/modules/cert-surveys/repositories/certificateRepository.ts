import { getPostgresClient } from '../../../postgresClient';
import {
  vesselCertificateApplicability,
  shipCertificatesMaster,
  vesselCertificateData,
} from '@shared/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';

// ── Helpers ──

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

// ── Operational Certificate Queries ──

export async function getApplicableCertificates() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselCertificateApplicability)
    .where(eq(vesselCertificateApplicability.isApplicable, true));
}

export async function getMasterCertificatesByIds(masterIds: string[]) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipCertificatesMaster)
    .where(
      and(
        eq(shipCertificatesMaster.applicableToCompany, true),
        inArray(shipCertificatesMaster.masterId, masterIds)
      )
    )
    .orderBy(asc(shipCertificatesMaster.companySequence));
}

export async function getAllVesselCertificateData() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselCertificateData);
}

export async function getCertificateApplicability(vesselId: string, masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselCertificateApplicability)
    .where(
      and(
        eq(vesselCertificateApplicability.vesselId, vesselId),
        eq(vesselCertificateApplicability.masterId, masterId),
        eq(vesselCertificateApplicability.isApplicable, true)
      )
    )
    .limit(1);
}

export async function getMasterCertificateById(masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipCertificatesMaster)
    .where(eq(shipCertificatesMaster.masterId, masterId))
    .limit(1);
}

export async function getVesselCertificateDataByKey(vesselId: string, masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselCertificateData)
    .where(
      and(
        eq(vesselCertificateData.vesselId, vesselId),
        eq(vesselCertificateData.masterId, masterId)
      )
    )
    .limit(1);
}

export async function updateCertificateData(vesselId: string, masterId: string, updateData: any) {
  const db = await getDb();
  if (!db) return null;
  return db.update(vesselCertificateData)
    .set({ ...updateData, updatedAt: new Date() })
    .where(
      and(
        eq(vesselCertificateData.vesselId, vesselId),
        eq(vesselCertificateData.masterId, masterId)
      )
    )
    .returning();
}

export async function insertCertificateData(data: {
  vesselId: string;
  vesselName: string;
  masterId: string;
  [key: string]: any;
}) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(vesselCertificateData)
    .values(data)
    .returning();
}

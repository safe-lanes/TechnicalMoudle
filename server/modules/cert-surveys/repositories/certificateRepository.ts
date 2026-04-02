import { getPostgresClient } from '../../../postgresClient';
import {
  vesselCertificateApplicability,
  shipCertificatesMaster,
  vesselCertificateData,
} from '@shared/schema';
import { eq, and, asc, inArray, or, isNull } from 'drizzle-orm';

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
    .where(
      and(
        eq(vesselCertificateApplicability.isApplicable, true),
        or(eq(vesselCertificateApplicability.isDeleted, false), isNull(vesselCertificateApplicability.isDeleted))
      )
    );
}

export async function getMasterCertificatesByIds(masterIds: string[]) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipCertificatesMaster)
    .where(
      and(
        inArray(shipCertificatesMaster.masterId, masterIds),
        eq(shipCertificatesMaster.isActive, true),
        or(eq(shipCertificatesMaster.isDeleted, false), isNull(shipCertificatesMaster.isDeleted))
      )
    )
    .orderBy(asc(shipCertificatesMaster.companySequence));
}

export async function getAllVesselCertificateData() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselCertificateData)
    .where(
      or(eq(vesselCertificateData.isDeleted, false), isNull(vesselCertificateData.isDeleted))
    );
}

export async function getCertificateApplicability(vesselId: string, masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselCertificateApplicability)
    .where(
      and(
        eq(vesselCertificateApplicability.vesselId, vesselId),
        eq(vesselCertificateApplicability.masterId, masterId),
        eq(vesselCertificateApplicability.isApplicable, true),
        or(eq(vesselCertificateApplicability.isDeleted, false), isNull(vesselCertificateApplicability.isDeleted))
      )
    )
    .limit(1);
}

export async function getMasterCertificateById(masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipCertificatesMaster)
    .where(
      and(
        eq(shipCertificatesMaster.masterId, masterId),
        eq(shipCertificatesMaster.isActive, true),
        or(eq(shipCertificatesMaster.isDeleted, false), isNull(shipCertificatesMaster.isDeleted))
      )
    )
    .limit(1);
}

export async function getVesselCertificateDataByKey(vesselId: string, masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselCertificateData)
    .where(
      and(
        eq(vesselCertificateData.vesselId, vesselId),
        eq(vesselCertificateData.masterId, masterId),
        or(eq(vesselCertificateData.isDeleted, false), isNull(vesselCertificateData.isDeleted))
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
        eq(vesselCertificateData.masterId, masterId),
        or(eq(vesselCertificateData.isDeleted, false), isNull(vesselCertificateData.isDeleted))
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

import { getPostgresClient } from '../../../postgresClient';
import {
  shipCertificatesMaster,
  shipCertificatesLabelsConfig,
  vesselCertificateApplicability,
  vessels,
} from '@shared/schema';
import { eq, and, inArray, or, like } from 'drizzle-orm';

// ── Helpers ──

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

// ══════════════════════════════════════════════════════════
// Master Certificate CRUD
// ══════════════════════════════════════════════════════════

export async function getMasterCertificates() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipCertificatesMaster)
    .where(eq(shipCertificatesMaster.isDeleted, false))
    .orderBy(shipCertificatesMaster.sequence);
}

export async function getMasterCertificateByMasterId(masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipCertificatesMaster)
    .where(eq(shipCertificatesMaster.masterId, masterId))
    .limit(1);
}

export async function getMasterCertificateSystemFlag(masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select({ id: shipCertificatesMaster.id, isSystemDefined: shipCertificatesMaster.isSystemDefined })
    .from(shipCertificatesMaster)
    .where(and(eq(shipCertificatesMaster.masterId, masterId), eq(shipCertificatesMaster.isDeleted, false)))
    .limit(1);
}

export async function updateMasterCertificate(masterId: string, data: any) {
  const db = await getDb();
  if (!db) return null;
  return db.update(shipCertificatesMaster)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(shipCertificatesMaster.masterId, masterId));
}

export async function insertMasterCertificate(data: any) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(shipCertificatesMaster).values(data);
}

export async function deleteMasterCertificate(masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(shipCertificatesMaster)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(shipCertificatesMaster.masterId, masterId));
}

// ══════════════════════════════════════════════════════════
// Labels Configuration
// ══════════════════════════════════════════════════════════

export async function getCertificateLabels() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipCertificatesLabelsConfig);
}

export async function deleteCertificateLabelsByType(configType: string) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(shipCertificatesLabelsConfig)
    .where(eq(shipCertificatesLabelsConfig.configType, configType));
}

export async function insertCertificateLabels(data: Array<{ configType: string; key: string; label: string }>) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(shipCertificatesLabelsConfig).values(data);
}

// ══════════════════════════════════════════════════════════
// Applicability
// ══════════════════════════════════════════════════════════

export async function getApplicabilityByVesselIds(vesselIdList: string[]) {
  const db = await getDb();
  if (!db) return null;
  return db.select()
    .from(vesselCertificateApplicability)
    .where(inArray(vesselCertificateApplicability.vesselId, vesselIdList));
}

export async function getApplicabilityByVesselId(vesselId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select()
    .from(vesselCertificateApplicability)
    .where(eq(vesselCertificateApplicability.vesselId, vesselId));
}

export async function getApplicabilityByVesselAndMaster(vesselId: string, masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select()
    .from(vesselCertificateApplicability)
    .where(and(
      eq(vesselCertificateApplicability.vesselId, vesselId),
      eq(vesselCertificateApplicability.masterId, masterId)
    ));
}

export async function insertApplicability(data: any) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(vesselCertificateApplicability)
    .values(data)
    .returning();
}

export async function insertApplicabilityBulk(data: Array<{
  vesselId: string;
  vesselName: string;
  masterId: string;
  isApplicable: boolean;
}>) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(vesselCertificateApplicability).values(data);
}

export async function updateApplicability(vesselId: string, masterId: string, isApplicable: boolean) {
  const db = await getDb();
  if (!db) return null;
  return db.update(vesselCertificateApplicability)
    .set({ isApplicable, updatedAt: new Date() })
    .where(and(
      eq(vesselCertificateApplicability.vesselId, vesselId),
      eq(vesselCertificateApplicability.masterId, masterId)
    ))
    .returning();
}

export async function bulkUpdateApplicability(vesselIds: string[], masterId: string, isApplicable: boolean) {
  const db = await getDb();
  if (!db) return null;
  return db.update(vesselCertificateApplicability)
    .set({ isApplicable, updatedAt: new Date() })
    .where(and(
      inArray(vesselCertificateApplicability.vesselId, vesselIds),
      eq(vesselCertificateApplicability.masterId, masterId)
    ))
    .returning();
}

export async function getDistinctVessels() {
  const db = await getDb();
  if (!db) return null;
  return db.selectDistinct({
    vesselId: vesselCertificateApplicability.vesselId,
    vesselName: vesselCertificateApplicability.vesselName,
  }).from(vesselCertificateApplicability);
}

export async function getApplicabilityByMasterIds(masterIds: string[]) {
  const db = await getDb();
  if (!db) return null;
  return db.select({
    vesselId: vesselCertificateApplicability.vesselId,
    masterId: vesselCertificateApplicability.masterId,
  }).from(vesselCertificateApplicability)
    .where(inArray(vesselCertificateApplicability.masterId, masterIds));
}

export async function getAllVessels() {
  const db = await getDb();
  if (!db) return null;
  return db.select({
    vesselId: vessels.vuuid,
    vesselName: vessels.name,
  }).from(vessels)
    .where(eq(vessels.isActive, true));
}

export async function getCompanyCertificates() {
  const db = await getDb();
  if (!db) return null;
  return db.select()
    .from(shipCertificatesMaster)
    .where(
      and(
        eq(shipCertificatesMaster.isDeleted, false),
        or(
          eq(shipCertificatesMaster.applicableToCompany, true),
          like(shipCertificatesMaster.masterId, 'CMP-%')
        )
      )
    );
}

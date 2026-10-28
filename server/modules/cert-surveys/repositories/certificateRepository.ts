import { getPostgresClient } from '../../../postgresClient';
import {
  vesselCertificateApplicability,
  shipCertificatesMaster,
  vesselCertificateData,
} from '@shared/schema';
import { eq, and, asc, inArray, or, isNull, sql } from 'drizzle-orm';
import { queryCertificatePage, type CertificatePagingFilters } from './certificatePagingRepository';

// ── Helpers ──

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

// ── Operational Certificate Queries ──

type CertificateReadDb = Pick<NonNullable<ReturnType<typeof getDb>>, 'select' | 'execute'>;

/** Count and every sorted page share one read-only snapshot. */
export async function getCertificateListPage(filters: CertificatePagingFilters) {
  const db = getDb();
  if (!db) throw Object.assign(new Error('Database not available'), { statusCode: 500 });
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    return queryCertificatePage(tx, filters);
  });
}

export async function getApplicableCertificates(db: CertificateReadDb | null = getDb()) {
  if (!db) return null;
  return db.select().from(vesselCertificateApplicability)
    .where(
      and(
        eq(vesselCertificateApplicability.isApplicable, true),
        or(eq(vesselCertificateApplicability.isDeleted, false), isNull(vesselCertificateApplicability.isDeleted))
      )
    );
}

export async function getMasterCertificatesByIds(masterIds: string[], db: CertificateReadDb | null = getDb()) {
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

export async function getAllVesselCertificateData(db: CertificateReadDb | null = getDb()) {
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
  // Make insert idempotent against the partial unique index
  // uniq_vessel_certificate_data_live so the read-then-insert pattern in
  // certificateService.updateCertificate cannot race itself and 23505. If a
  // concurrent insert won the race, fall back to updating that live row with
  // the same payload.
  const inserted = await db.insert(vesselCertificateData)
    .values(data)
    .onConflictDoNothing({
      target: [vesselCertificateData.vesselId, vesselCertificateData.masterId],
      where: sql`${vesselCertificateData.isDeleted} = false`,
    })
    .returning();
  if (inserted.length > 0) return inserted;
  const { vesselId, masterId, vesselName: _ignored, ...updateData } = data;
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

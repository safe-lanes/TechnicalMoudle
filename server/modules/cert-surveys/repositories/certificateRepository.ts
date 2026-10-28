import { getPostgresClient } from '../../../postgresClient';
import {
  vesselCertificateApplicability,
  shipCertificatesMaster,
  vesselCertificateData,
} from '@shared/schema';
import { eq, and, asc, inArray, or, isNull, sql } from 'drizzle-orm';

// ── Helpers ──

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

// ── Operational Certificate Queries ──

type CertificateReadDb = Pick<NonNullable<ReturnType<typeof getDb>>, 'select' | 'execute'>;

export interface CertificatePageRow {
  /** Internal hydration identity, removed before returning HTTP rows. */
  _certificateDataId?: number;
  attachments: unknown;
}

/** Keep compatibility ordering and attachment hydration on one read snapshot. */
export async function withCertificateReadSnapshot<T>(
  read: (reader: {
    getApplicableCertificates: () => ReturnType<typeof getApplicableCertificates>;
    getMasterCertificatesByIds: (ids: string[]) => ReturnType<typeof getMasterCertificatesByIds>;
    getVesselCertificateMetadata: () => ReturnType<typeof getVesselCertificateMetadata>;
    getCertificatePage: <Row extends CertificatePageRow>(rows: Row[], page: number, limit: number) => Promise<Row[]>;
  }) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  if (!db) throw Object.assign(new Error('Database not available'), { statusCode: 500 });
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    return read({
      getApplicableCertificates: () => getApplicableCertificates(tx),
      getMasterCertificatesByIds: ids => getMasterCertificatesByIds(ids, tx),
      getVesselCertificateMetadata: () => getVesselCertificateMetadata(tx),
      getCertificatePage: (rows, page, limit) => getCertificatePage(tx, rows, page, limit),
    });
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

/** Lightweight values for the existing JavaScript compatibility comparator. */
export async function getVesselCertificateMetadata(db: CertificateReadDb | null = getDb()) {
  if (!db) return null;
  return db.select({
    id: vesselCertificateData.id,
    vesselId: vesselCertificateData.vesselId,
    masterId: vesselCertificateData.masterId,
    certificateNumber: vesselCertificateData.certificateNumber,
    issueDate: vesselCertificateData.issueDate,
    expiryDate: vesselCertificateData.expiryDate,
    lastAnnual: vesselCertificateData.lastAnnual,
    nextAnnual: vesselCertificateData.nextAnnual,
    lastInterm: vesselCertificateData.lastInterm,
    nextInterm: vesselCertificateData.nextInterm,
    endorsementDate: vesselCertificateData.endorsementDate,
    lastEditUpload: vesselCertificateData.lastEditUpload,
  }).from(vesselCertificateData)
    .where(or(eq(vesselCertificateData.isDeleted, false), isNull(vesselCertificateData.isDeleted)));
}

export async function getCertificatePage<Row extends CertificatePageRow>(
  db: CertificateReadDb, rows: Row[], page: number, limit: number,
): Promise<Row[]> {
  if (!rows.length) return [];
  // Match the previous Array.slice window, including negative legacy inputs.
  const offset = (page - 1) * limit;
  const index = (value: number) => value < 0
    ? Math.max(rows.length + value, 0) : Math.min(value, rows.length);
  const start = index(offset);
  const length = Math.max(index(offset + limit) - start, 0);
  const ranks = rows.map((row, rank) => ({ rank, data_id: row._certificateDataId ?? null }));
  const result = await db.execute(sql`
    WITH page AS MATERIALIZED (
      SELECT rank, data_id
      FROM jsonb_to_recordset(${JSON.stringify(ranks)}::jsonb) AS ranked(rank integer, data_id integer)
      ORDER BY rank LIMIT ${length} OFFSET ${start}
    )
    SELECT page.rank, data.attachments
    FROM page
    LEFT JOIN vessel_certificate_data data ON data.id = page.data_id
    ORDER BY page.rank
  `);
  return result.rows.map(record => {
    const { _certificateDataId, ...row } = rows[Number(record.rank)];
    return { ...row, attachments: record.attachments || [] } as unknown as Row;
  });
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

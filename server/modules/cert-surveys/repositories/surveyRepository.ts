import { getPostgresClient } from '../../../postgresClient';
import { storage } from '../../../storage';
import {
  vesselSurveyApplicability,
  shipSurveysMaster,
  vesselSurveyData,
} from '@shared/schema';
import { eq, and, asc, inArray, or, sql } from 'drizzle-orm';
import { querySurveyPage, type SurveyPagingFilters } from './surveyPagingRepository';

// ── Helpers ──

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

// ── Operational Survey Queries (Direct Drizzle) ──

type SurveyReadDb = Pick<NonNullable<ReturnType<typeof getDb>>, 'select' | 'execute'>;

export async function getSurveyListPage(filters: SurveyPagingFilters) {
  const db = getDb();
  if (!db) throw Object.assign(new Error('Database not available'), { statusCode: 500 });
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    return querySurveyPage(tx, filters);
  });
}

export async function getApplicableSurveys(db: SurveyReadDb | null = getDb()) {
  if (!db) return null;
  return db.select().from(vesselSurveyApplicability)
    .where(and(
      eq(vesselSurveyApplicability.isApplicable, true),
      or(eq(vesselSurveyApplicability.isDeleted, false), sql`${vesselSurveyApplicability.isDeleted} IS NULL`)
    ));
}

export async function getMasterSurveysByIds(masterIds: string[], db: SurveyReadDb | null = getDb()) {
  if (!db) return null;
  return db.select().from(shipSurveysMaster)
    .where(and(
      inArray(shipSurveysMaster.masterId, masterIds),
      eq(shipSurveysMaster.isDeleted, false),
      eq(shipSurveysMaster.isActive, true)
    ))
    .orderBy(asc(shipSurveysMaster.companySequence));
}

export async function getAllVesselSurveyData(db: SurveyReadDb | null = getDb()) {
  if (!db) return null;
  return db.select().from(vesselSurveyData);
}

export async function getSurveyApplicabilityByKey(vesselId: string, masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselSurveyApplicability)
    .where(
      and(
        eq(vesselSurveyApplicability.vesselId, vesselId),
        eq(vesselSurveyApplicability.masterId, masterId)
      )
    )
    .limit(1);
}

export async function getVesselSurveyDataByKey(vesselId: string, masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselSurveyData)
    .where(
      and(
        eq(vesselSurveyData.vesselId, vesselId),
        eq(vesselSurveyData.masterId, masterId)
      )
    )
    .limit(1);
}

export async function updateSurveyData(vesselId: string, masterId: string, updateData: any) {
  const db = await getDb();
  if (!db) return null;
  return db.update(vesselSurveyData)
    .set(updateData)
    .where(
      and(
        eq(vesselSurveyData.vesselId, vesselId),
        eq(vesselSurveyData.masterId, masterId)
      )
    )
    .returning();
}

export async function insertSurveyData(data: {
  vesselId: string;
  vesselName: string;
  masterId: string;
  [key: string]: any;
}) {
  const db = await getDb();
  if (!db) return null;
  // Make insert idempotent against the unique index
  // uniq_vessel_survey_data_vessel_master so the read-then-insert pattern in
  // surveyService.updateSurvey cannot race itself and 23505. If a concurrent
  // insert won the race, fall back to updating that row with the same payload.
  const inserted = await db.insert(vesselSurveyData)
    .values(data)
    .onConflictDoNothing({
      target: [vesselSurveyData.vesselId, vesselSurveyData.masterId],
    })
    .returning();
  if (inserted.length > 0) return inserted;
  const { vesselId, masterId, vesselName: _ignored, ...updateData } = data;
  return db.update(vesselSurveyData)
    .set({ ...updateData, updatedAt: new Date() })
    .where(
      and(
        eq(vesselSurveyData.vesselId, vesselId),
        eq(vesselSurveyData.masterId, masterId)
      )
    )
    .returning();
}

// ── Storage-based Survey Operations ──

export async function getSurveys() {
  return storage.getSurveys();
}

export async function getSurvey(id: string) {
  return storage.getSurvey(id);
}

export async function createSurvey(data: any) {
  return storage.createSurvey(data);
}

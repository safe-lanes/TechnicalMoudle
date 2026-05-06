import { getPostgresClient } from '../../../postgresClient';
import {
  shipSurveysMaster,
  shipSurveysLabelsConfig,
  vesselSurveyApplicability,
  vessels,
} from '@shared/schema';
import { eq, and, inArray, or, like, sql, notInArray } from 'drizzle-orm';

// ── Helpers ──

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

// ══════════════════════════════════════════════════════════
// Master Survey CRUD
// ══════════════════════════════════════════════════════════

export async function getMasterSurveys() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipSurveysMaster)
    .where(eq(shipSurveysMaster.isDeleted, false))
    .orderBy(shipSurveysMaster.sequence);
}

export async function getMasterSurveyByMasterId(masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipSurveysMaster)
    .where(and(
      eq(shipSurveysMaster.masterId, masterId),
      eq(shipSurveysMaster.isDeleted, false)
    ))
    .limit(1);
}

export async function updateMasterSurvey(masterId: string, data: any) {
  const db = await getDb();
  if (!db) return null;
  return db.update(shipSurveysMaster)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(shipSurveysMaster.masterId, masterId));
}

export async function insertMasterSurvey(data: any) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(shipSurveysMaster)
    .values(data)
    .onConflictDoUpdate({
      target: shipSurveysMaster.masterId,
      set: {
        sequence: data.sequence,
        surveyName: data.surveyName,
        category: data.category,
        group: data.group,
        requirementRef: data.requirementRef,
        applicableToCompany: data.applicableToCompany,
        surveyLabel: data.surveyLabel,
        isActive: data.isActive !== false,
        isDeleted: false,
        companyId: data.companyId,
        companyGroup: data.companyGroup,
        companySequence: data.companySequence,
        updatedAt: new Date(),
      },
    });
}

export async function deleteMasterSurvey(masterId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(shipSurveysMaster)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(shipSurveysMaster.masterId, masterId));
}

// ══════════════════════════════════════════════════════════
// Labels Configuration
// ══════════════════════════════════════════════════════════

export async function getSurveyLabels() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipSurveysLabelsConfig);
}

export async function deleteSurveyLabelsByType(configType: string) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(shipSurveysLabelsConfig)
    .where(eq(shipSurveysLabelsConfig.configType, configType));
}

export async function insertSurveyLabels(data: Array<{ configType: string; key: string; label: string }>) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(shipSurveysLabelsConfig).values(data);
}

// ══════════════════════════════════════════════════════════
// Applicability
// ══════════════════════════════════════════════════════════

export async function getApplicabilityByVesselIds(vesselIdList: string[]) {
  const db = await getDb();
  if (!db) return null;
  return db.select()
    .from(vesselSurveyApplicability)
    .where(and(
      inArray(vesselSurveyApplicability.vesselId, vesselIdList),
      or(eq(vesselSurveyApplicability.isDeleted, false), sql`${vesselSurveyApplicability.isDeleted} IS NULL`)
    ));
}

export async function getApplicabilityByVesselId(vesselId: string) {
  const db = await getDb();
  if (!db) return null;
  return db.select()
    .from(vesselSurveyApplicability)
    .where(and(
      eq(vesselSurveyApplicability.vesselId, vesselId),
      or(eq(vesselSurveyApplicability.isDeleted, false), sql`${vesselSurveyApplicability.isDeleted} IS NULL`)
    ));
}

export async function insertApplicabilityBulk(data: Array<{
  vesselId: string;
  vesselName: string;
  masterId: string;
  isApplicable: boolean;
  isDeleted?: boolean;
}>) {
  const db = await getDb();
  if (!db) return null;
  // Make insert idempotent against the partial unique index
  // uniq_vessel_survey_applicability_live so concurrent initialize/bulk-update
  // calls cannot 23505 each other.
  return db.insert(vesselSurveyApplicability)
    .values(data)
    .onConflictDoNothing({
      target: [vesselSurveyApplicability.vesselId, vesselSurveyApplicability.masterId],
      where: sql`${vesselSurveyApplicability.isDeleted} = false`,
    })
    .returning();
}

export async function bulkUpdateApplicability(vesselIds: string[], masterId: string, isApplicable: boolean) {
  const db = await getDb();
  if (!db) return null;
  return db.update(vesselSurveyApplicability)
    .set({ isApplicable, updatedAt: new Date() })
    .where(and(
      inArray(vesselSurveyApplicability.vesselId, vesselIds),
      eq(vesselSurveyApplicability.masterId, masterId),
      or(eq(vesselSurveyApplicability.isDeleted, false), sql`${vesselSurveyApplicability.isDeleted} IS NULL`)
    ))
    .returning();
}

export async function getDistinctVessels() {
  const db = await getDb();
  if (!db) return null;
  return db.selectDistinct({
    vesselId: vesselSurveyApplicability.vesselId,
    vesselName: vesselSurveyApplicability.vesselName,
  }).from(vesselSurveyApplicability);
}

export async function getAllApplicability() {
  const db = await getDb();
  if (!db) return null;
  return db.select({
    vesselId: vesselSurveyApplicability.vesselId,
    masterId: vesselSurveyApplicability.masterId,
  }).from(vesselSurveyApplicability)
    .where(
      or(eq(vesselSurveyApplicability.isDeleted, false), sql`${vesselSurveyApplicability.isDeleted} IS NULL`)
    );
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

export async function getCompanySurveys() {
  const db = await getDb();
  if (!db) return null;
  return db.select()
    .from(shipSurveysMaster)
    .where(
      and(
        eq(shipSurveysMaster.isDeleted, false),
        or(
          eq(shipSurveysMaster.applicableToCompany, true),
          like(shipSurveysMaster.masterId, 'CMP-%')
        )
      )
    );
}

export async function getCompanyApplicableMasterIds() {
  const db = await getDb();
  if (!db) return null;
  return db.select({
    masterId: shipSurveysMaster.masterId,
  }).from(shipSurveysMaster)
    .where(
      and(
        eq(shipSurveysMaster.isActive, true),
        eq(shipSurveysMaster.isDeleted, false),
        or(
          eq(shipSurveysMaster.applicableToCompany, true),
          like(shipSurveysMaster.masterId, 'CMP-%'),
          like(shipSurveysMaster.masterId, 'VES-%')
        )
      )
    );
}

export async function getAllApplicabilityRecords() {
  const db = await getDb();
  if (!db) return null;
  return db.select({
    vesselId: vesselSurveyApplicability.vesselId,
    masterId: vesselSurveyApplicability.masterId,
  }).from(vesselSurveyApplicability)
    .where(
      or(eq(vesselSurveyApplicability.isDeleted, false), sql`${vesselSurveyApplicability.isDeleted} IS NULL`)
    );
}

export async function softDeleteApplicabilityByMasterIds(masterIds: string[]) {
  const db = await getDb();
  if (!db) return null;
  if (masterIds.length === 0) return [];
  return db.update(vesselSurveyApplicability)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(
        inArray(vesselSurveyApplicability.masterId, masterIds),
        or(eq(vesselSurveyApplicability.isDeleted, false), sql`${vesselSurveyApplicability.isDeleted} IS NULL`)
      )
    )
    .returning({ masterId: vesselSurveyApplicability.masterId });
}

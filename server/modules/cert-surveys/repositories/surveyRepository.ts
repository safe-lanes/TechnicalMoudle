import { getPostgresClient } from '../../../postgresClient';
import { storage } from '../../../storage';
import {
  vesselSurveyApplicability,
  shipSurveysMaster,
  vesselSurveyData,
} from '@shared/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';

// ── Helpers ──

function getDb() {
  const postgres = getPostgresClient();
  if (!postgres) return null;
  return postgres.db;
}

// ── Operational Survey Queries (Direct Drizzle) ──

export async function getApplicableSurveys() {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(vesselSurveyApplicability)
    .where(eq(vesselSurveyApplicability.isApplicable, true));
}

export async function getMasterSurveysByIds(masterIds: string[]) {
  const db = await getDb();
  if (!db) return null;
  return db.select().from(shipSurveysMaster)
    .where(inArray(shipSurveysMaster.masterId, masterIds))
    .orderBy(asc(shipSurveysMaster.companySequence));
}

export async function getAllVesselSurveyData() {
  const db = await getDb();
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
  return db.insert(vesselSurveyData)
    .values(data)
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

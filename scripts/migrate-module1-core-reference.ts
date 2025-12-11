#!/usr/bin/env npx tsx
/**
 * Module 1: Core Reference Data Migration Script
 * Migrates users, fleets, vessels, pms_vessel_settings from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module1-core-reference.ts
 * 
 * Features:
 * - Transaction support for atomic migration (rollback on any error)
 * - BEFORE/AFTER count comparison for accurate reporting
 * - Proper error handling with immediate rollback
 * - Idempotent: safe to run multiple times
 */

import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import {
  users,
  fleets,
  vessels,
  pmsVesselSettings,
} from '../shared/schema';

const DATA_FILE = path.join(process.cwd(), 'test-data.json');

interface MigrationResult {
  table: string;
  fileCount: number;
  beforeCount: number;
  afterCount: number;
  migratedCount: number;
  skippedCount: number;
}

async function loadFileData(): Promise<any> {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Data file not found: ${DATA_FILE}`);
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function normalizeRole(role: string | undefined): 'Ship' | 'Office' | 'PMS Admin' {
  if (!role) return 'Ship';
  const normalized = role.trim();
  if (normalized === 'Ship' || normalized === 'Office' || normalized === 'PMS Admin') {
    return normalized;
  }
  return 'Ship';
}

async function getCount(tx: any, table: any): Promise<number> {
  const result = await tx.select({ count: sql<number>`count(*)::int` }).from(table);
  return result[0]?.count ?? 0;
}

async function migrateWithTransaction(db: any, fileData: any): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  await db.transaction(async (tx: any) => {
    console.log('\n[TRANSACTION] Starting atomic migration...');
    console.log('[TRANSACTION] Any error will cause full rollback.\n');

    // Get BEFORE counts
    const fleetsBefore = await getCount(tx, fleets);
    const vesselsBefore = await getCount(tx, vessels);
    const usersBefore = await getCount(tx, users);
    const settingsBefore = await getCount(tx, pmsVesselSettings);

    // 1. Migrate Fleets (no dependencies)
    const fleetsData = fileData.fleets || {};
    const fleetList = Object.values(fleetsData) as any[];
    console.log(`[fleets] Processing ${fleetList.length} records (${fleetsBefore} existing)...`);

    for (const fleet of fleetList) {
      const existing = await tx.select().from(fleets).where(eq(fleets.id, fleet.id));
      if (existing.length === 0) {
        await tx.insert(fleets).values({
          id: fleet.id,
          code: fleet.code,
          name: fleet.name,
          description: fleet.description || null,
          isActive: fleet.isActive !== false,
        });
      }
    }
    const fleetsAfter = await getCount(tx, fleets);
    results.push({
      table: 'fleets',
      fileCount: fleetList.length,
      beforeCount: fleetsBefore,
      afterCount: fleetsAfter,
      migratedCount: fleetsAfter - fleetsBefore,
      skippedCount: fleetList.length - (fleetsAfter - fleetsBefore),
    });
    console.log(`[fleets] Done: ${fleetsAfter - fleetsBefore} migrated, ${fleetList.length - (fleetsAfter - fleetsBefore)} skipped`);

    // 2. Migrate Vessels (depends on fleets)
    const vesselsData = fileData.vessels || {};
    const vesselList = Object.values(vesselsData) as any[];
    console.log(`\n[vessels] Processing ${vesselList.length} records (${vesselsBefore} existing)...`);

    for (const vessel of vesselList) {
      const existing = await tx.select().from(vessels).where(eq(vessels.id, vessel.id));
      if (existing.length === 0) {
        await tx.insert(vessels).values({
          id: vessel.id,
          name: vessel.name,
          code: vessel.code || vessel.id,
          fleetId: vessel.fleetId || vessel.fleet_id || null,
          imoNumber: vessel.imoNumber || vessel.imo_number || null,
          vesselType: vessel.vesselType || vessel.vessel_type || null,
          flag: vessel.flag || null,
          isActive: vessel.isActive !== false,
        });
      }
    }
    const vesselsAfter = await getCount(tx, vessels);
    results.push({
      table: 'vessels',
      fileCount: vesselList.length,
      beforeCount: vesselsBefore,
      afterCount: vesselsAfter,
      migratedCount: vesselsAfter - vesselsBefore,
      skippedCount: vesselList.length - (vesselsAfter - vesselsBefore),
    });
    console.log(`[vessels] Done: ${vesselsAfter - vesselsBefore} migrated, ${vesselList.length - (vesselsAfter - vesselsBefore)} skipped`);

    // 3. Migrate Users (depends on vessels)
    const usersData = fileData.users || {};
    const userList = Object.values(usersData) as any[];
    console.log(`\n[users] Processing ${userList.length} records (${usersBefore} existing)...`);

    for (const user of userList) {
      const existing = await tx.select().from(users).where(eq(users.username, user.username));
      if (existing.length === 0) {
        await tx.insert(users).values({
          username: user.username,
          password: user.password,
          fullName: user.fullName || user.full_name || 'Unknown',
          email: user.email || null,
          role: normalizeRole(user.role),
          vesselId: user.vesselId || user.vessel_id || null,
          department: user.department || null,
          isActive: user.isActive !== false,
        });
      }
    }
    const usersAfter = await getCount(tx, users);
    results.push({
      table: 'users',
      fileCount: userList.length,
      beforeCount: usersBefore,
      afterCount: usersAfter,
      migratedCount: usersAfter - usersBefore,
      skippedCount: userList.length - (usersAfter - usersBefore),
    });
    console.log(`[users] Done: ${usersAfter - usersBefore} migrated, ${userList.length - (usersAfter - usersBefore)} skipped`);

    // 4. Migrate PMS Vessel Settings (depends on vessels)
    const settingsData = fileData.pmsVesselSettings || {};
    const settingsList = Object.values(settingsData) as any[];
    console.log(`\n[pms_vessel_settings] Processing ${settingsList.length} records (${settingsBefore} existing)...`);

    for (const settings of settingsList) {
      const vesselId = settings.vesselId || settings.vessel_id;
      const existing = await tx.select().from(pmsVesselSettings).where(eq(pmsVesselSettings.vesselId, vesselId));
      if (existing.length === 0) {
        await tx.insert(pmsVesselSettings).values({
          vesselId: vesselId,
          calendarLeadDaysCritical: settings.calendarLeadDaysCritical ?? settings.calendar_lead_days_critical ?? 7,
          calendarLeadDaysNonCritical: settings.calendarLeadDaysNonCritical ?? settings.calendar_lead_days_non_critical ?? 14,
          calendarGraceMode: settings.calendarGraceMode ?? settings.calendar_grace_mode ?? 'COMPANY_STANDARD',
          calendarGraceDays: settings.calendarGraceDays ?? settings.calendar_grace_days ?? 7,
          rhLeadHoursCritical: settings.rhLeadHoursCritical ?? settings.rh_lead_hours_critical ?? 50,
          rhLeadHoursNonCritical: settings.rhLeadHoursNonCritical ?? settings.rh_lead_hours_non_critical ?? 100,
          rhGraceHours: settings.rhGraceHours ?? settings.rh_grace_hours ?? 168,
          locationAName: settings.locationAName ?? settings.location_a_name ?? 'Location A',
          locationBName: settings.locationBName ?? settings.location_b_name ?? 'Location B',
          updatedBy: settings.updatedBy ?? settings.updated_by ?? 'migration',
        });
      }
    }
    const settingsAfter = await getCount(tx, pmsVesselSettings);
    results.push({
      table: 'pms_vessel_settings',
      fileCount: settingsList.length,
      beforeCount: settingsBefore,
      afterCount: settingsAfter,
      migratedCount: settingsAfter - settingsBefore,
      skippedCount: settingsList.length - (settingsAfter - settingsBefore),
    });
    console.log(`[pms_vessel_settings] Done: ${settingsAfter - settingsBefore} migrated, ${settingsList.length - (settingsAfter - settingsBefore)} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 1: Core Reference Data Migration');
  console.log('='.repeat(60));

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('\nLoading data from test-data.json...');
    const fileData = await loadFileData();

    console.log('Connecting to PostgreSQL...');
    const db = await getDb();

    const results = await migrateWithTransaction(db, fileData);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    
    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const result of results) {
      console.log(`\n${result.table}:`);
      console.log(`  Source records: ${result.fileCount}`);
      console.log(`  Before: ${result.beforeCount} → After: ${result.afterCount}`);
      console.log(`  Migrated: ${result.migratedCount}`);
      console.log(`  Skipped (already exist): ${result.skippedCount}`);
      
      totalMigrated += result.migratedCount;
      totalSkipped += result.skippedCount;
    }

    console.log('\n' + '-'.repeat(60));
    console.log(`TOTAL: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    console.log('='.repeat(60));
    console.log('\nMigration completed successfully!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('MIGRATION FAILED - Transaction rolled back');
    console.error('='.repeat(60));
    console.error('\nError:', error.message || error);
    process.exit(1);
  }
}

main();

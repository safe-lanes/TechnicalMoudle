#!/usr/bin/env npx tsx
/**
 * Module 1: Core Reference Data Validation Script
 * Validates that data was migrated correctly from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/validate-module1-migration.ts
 */

import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import {
  users,
  fleets,
  vessels,
  pmsVesselSettings,
} from '../shared/schema';

const DATA_FILE = path.join(process.cwd(), 'test-data.json');

interface ValidationResult {
  table: string;
  fileCount: number;
  pgCount: number;
  countMatch: boolean;
  sampleCheck: boolean;
  issues: string[];
}

async function loadFileData(): Promise<any> {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Data file not found: ${DATA_FILE}`);
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function validateUsers(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'users',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const usersData = fileData.users || {};
  const userList = Object.values(usersData) as any[];
  result.fileCount = userList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(users);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.fileCount === result.pgCount;
  if (!result.countMatch) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (userList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${userList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleUser = userList[0];
      const pgUsers = await db.select().from(users);
      const pgSample = pgUsers.find((u: any) => u.username === sampleUser.username);
      
      if (pgSample) {
        const fullNameMatch = pgSample.fullName === (sampleUser.fullName || sampleUser.full_name || 'Unknown');
        const roleMatch = pgSample.role === (sampleUser.role || 'Ship');
        result.sampleCheck = fullNameMatch && roleMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample user data mismatch for ${sampleUser.username}: fullName=${fullNameMatch}, role=${roleMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample user ${sampleUser.username} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateFleets(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'fleets',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const fleetsData = fileData.fleets || {};
  const fleetList = Object.values(fleetsData) as any[];
  result.fileCount = fleetList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(fleets);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.fileCount === result.pgCount;
  if (!result.countMatch) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (fleetList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${fleetList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleFleet = fleetList[0];
      const pgFleets = await db.select().from(fleets);
      const pgSample = pgFleets.find((f: any) => f.id === sampleFleet.id);
      
      if (pgSample) {
        const nameMatch = pgSample.name === sampleFleet.name;
        const codeMatch = pgSample.code === sampleFleet.code;
        result.sampleCheck = nameMatch && codeMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample fleet data mismatch for ${sampleFleet.id}: name=${nameMatch}, code=${codeMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample fleet ${sampleFleet.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }
  return result;
}

async function validateVessels(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'vessels',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const vesselsData = fileData.vessels || {};
  const vesselList = Object.values(vesselsData) as any[];
  result.fileCount = vesselList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(vessels);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.fileCount === result.pgCount;
  if (!result.countMatch) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (vesselList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${vesselList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleVessel = vesselList[0];
      const pgVessels = await db.select().from(vessels);
      const pgSample = pgVessels.find((v: any) => v.id === sampleVessel.id);
      
      if (pgSample) {
        const nameMatch = pgSample.name === sampleVessel.name;
        const codeMatch = pgSample.code === (sampleVessel.code || sampleVessel.id);
        result.sampleCheck = nameMatch && codeMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample vessel data mismatch for ${sampleVessel.id}: name=${nameMatch}, code=${codeMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample vessel ${sampleVessel.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validatePmsSettings(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'pms_vessel_settings',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const settingsData = fileData.pmsVesselSettings || {};
  const settingsList = Object.values(settingsData) as any[];
  result.fileCount = settingsList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(pmsVesselSettings);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.fileCount === result.pgCount;
  if (!result.countMatch) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (settingsList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${settingsList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleSettings = settingsList[0];
      const vesselId = sampleSettings.vesselId || sampleSettings.vessel_id;
      const pgSettings = await db.select().from(pmsVesselSettings);
      const pgSample = pgSettings.find((s: any) => s.vesselId === vesselId);
      
      if (pgSample) {
        const leadDaysMatch = pgSample.calendarLeadDaysCritical === (sampleSettings.calendarLeadDaysCritical ?? sampleSettings.calendar_lead_days_critical ?? 7);
        result.sampleCheck = leadDaysMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample PMS settings data mismatch for ${vesselId}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample PMS settings for ${vesselId} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }
  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 1: Core Reference Data Validation');
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

    const results: ValidationResult[] = [];

    results.push(await validateFleets(db, fileData));
    results.push(await validateVessels(db, fileData));
    results.push(await validateUsers(db, fileData));
    results.push(await validatePmsSettings(db, fileData));

    console.log('\n' + '='.repeat(60));
    console.log('Validation Summary');
    console.log('='.repeat(60));
    
    let allPassed = true;

    for (const result of results) {
      const status = result.countMatch && result.sampleCheck ? '✓ PASS' : '✗ FAIL';
      console.log(`\n${result.table}: ${status}`);
      console.log(`  File records: ${result.fileCount}`);
      console.log(`  PostgreSQL records: ${result.pgCount}`);
      console.log(`  Count match: ${result.countMatch ? 'Yes' : 'No'}`);
      console.log(`  Sample check: ${result.sampleCheck ? 'Pass' : 'Fail'}`);
      
      if (result.issues.length > 0) {
        console.log('  Issues:');
        result.issues.forEach(issue => console.log(`    - ${issue}`));
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('VALIDATION PASSED - All checks successful');
      console.log('\nModule 1 migration is verified and ready for use.');
      process.exit(0);
    } else {
      console.log('VALIDATION FAILED - See issues above');
      console.log('\nPlease review the issues and re-run the migration if necessary.');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('VALIDATION FAILED - Exception occurred');
    console.error('='.repeat(60));
    console.error('\nError:', error.message || error);
    process.exit(1);
  }
}

main();

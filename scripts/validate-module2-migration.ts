#!/usr/bin/env npx tsx
/**
 * Module 2: Master Data Migration Validation Script
 * Validates that makers, master_lists, maker_list, sfi_details, master_data
 * were correctly migrated from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/validate-module2-migration.ts
 */

import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import {
  makers,
  masterLists,
  makerList,
  sfiDetails,
  masterData,
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

async function validateMakers(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'makers',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const makersData = fileData.makers || {};
  const makersList = Object.values(makersData) as any[];
  result.fileCount = makersList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(makers);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (makersList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${makersList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleMaker = makersList[0];
      const pgMakers = await db.select().from(makers);
      const pgSample = pgMakers.find((m: any) => m.id === sampleMaker.id);
      
      if (pgSample) {
        const nameMatch = pgSample.makerName === (sampleMaker.makerName || sampleMaker.maker_name);
        const codeMatch = pgSample.makerCode === (sampleMaker.makerCode || sampleMaker.maker_code);
        result.sampleCheck = nameMatch && codeMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample maker data mismatch for id ${sampleMaker.id}: name=${nameMatch}, code=${codeMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample maker ${sampleMaker.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateMasterLists(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'master_lists',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const masterListsData = fileData.masterLists || {};
  const masterListsList = Object.values(masterListsData) as any[];
  result.fileCount = masterListsList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(masterLists);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (masterListsList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${masterListsList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleList = masterListsList[0];
      const pgLists = await db.select().from(masterLists);
      const pgSample = pgLists.find((l: any) => l.id === sampleList.id);
      
      if (pgSample) {
        const typeMatch = pgSample.listType === (sampleList.listType || sampleList.list_type);
        const valueMatch = pgSample.listValue === (sampleList.listValue || sampleList.list_value);
        result.sampleCheck = typeMatch && valueMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample master_list data mismatch for id ${sampleList.id}: type=${typeMatch}, value=${valueMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample master_list ${sampleList.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateMakerList(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'maker_list',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const makerListData = fileData.makerList || {};
  const makerListList = Object.values(makerListData) as any[];
  result.fileCount = makerListList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(makerList);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (makerListList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${makerListList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleItem = makerListList[0];
      const pgItems = await db.select().from(makerList);
      const pgSample = pgItems.find((i: any) => i.id === sampleItem.id);
      
      if (pgSample) {
        const nameMatch = pgSample.makerName === (sampleItem.makerName || sampleItem.maker_name);
        const codeMatch = pgSample.makerCode === (sampleItem.makerCode || sampleItem.maker_code);
        result.sampleCheck = nameMatch && codeMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample maker_list data mismatch for id ${sampleItem.id}: name=${nameMatch}, code=${codeMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample maker_list ${sampleItem.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateSfiDetails(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'sfi_details',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const sfiDetailsData = fileData.sfiDetails || {};
  const sfiDetailsList = Object.values(sfiDetailsData) as any[];
  result.fileCount = sfiDetailsList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(sfiDetails);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (sfiDetailsList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${sfiDetailsList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleSfi = sfiDetailsList[0];
      const pgSfis = await db.select().from(sfiDetails);
      const pgSample = pgSfis.find((s: any) => s.id === sampleSfi.id);
      
      if (pgSample) {
        const codeMatch = pgSample.componentCode === (sampleSfi.componentCode || sampleSfi.component_code);
        const nameMatch = pgSample.componentName === (sampleSfi.componentName || sampleSfi.component_name);
        result.sampleCheck = codeMatch && nameMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample sfi_details data mismatch for id ${sampleSfi.id}: code=${codeMatch}, name=${nameMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample sfi_details ${sampleSfi.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateMasterData(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'master_data',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const masterDataData = fileData.masterData || {};
  const masterDataList = Object.values(masterDataData) as any[];
  result.fileCount = masterDataList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(masterData);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (masterDataList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${masterDataList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleData = masterDataList[0];
      const pgDataList = await db.select().from(masterData);
      const pgSample = pgDataList.find((d: any) => d.id === sampleData.id);
      
      if (pgSample) {
        const equipmentMatch = pgSample.equipmentName === (sampleData.equipmentName || sampleData.equipment_name);
        const fleetCodeMatch = pgSample.fleetEquipmentCode === (sampleData.fleetEquipmentCode || sampleData.fleet_equipment_code);
        result.sampleCheck = equipmentMatch && fleetCodeMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample master_data mismatch for id ${sampleData.id}: equipment=${equipmentMatch}, fleetCode=${fleetCodeMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample master_data ${sampleData.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 2: Master Data Migration Validation');
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

    results.push(await validateMakers(db, fileData));
    results.push(await validateMasterLists(db, fileData));
    results.push(await validateMakerList(db, fileData));
    results.push(await validateSfiDetails(db, fileData));
    results.push(await validateMasterData(db, fileData));

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
      console.log('\nModule 2 migration is verified and ready for use.');
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

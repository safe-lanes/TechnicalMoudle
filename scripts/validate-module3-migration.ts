#!/usr/bin/env npx tsx
/**
 * Module 3: Components Data Migration Validation Script
 * Validates that components, component_documents, component_class_regulatory,
 * component_maintenance_history, component_requisitions, running_hours_audit
 * were correctly migrated from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/validate-module3-migration.ts
 */

import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import {
  components,
  componentDocuments,
  componentClassRegulatory,
  componentMaintenanceHistory,
  componentRequisitions,
  runningHoursAudit,
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

async function validateComponents(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'components',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const componentsData = fileData.components || {};
  const componentsList = Object.values(componentsData) as any[];
  result.fileCount = componentsList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(components);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (componentsList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${componentsList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleComp = componentsList[0];
      const pgComponents = await db.select().from(components);
      const pgSample = pgComponents.find((c: any) => c.id === sampleComp.id);
      
      if (pgSample) {
        const nameMatch = pgSample.name === (sampleComp.name || null);
        const codeMatch = pgSample.componentCode === (sampleComp.componentCode || sampleComp.component_code || null);
        result.sampleCheck = nameMatch || codeMatch; // At least one should match
        if (!result.sampleCheck) {
          result.issues.push(`Sample component data mismatch for id ${sampleComp.id}: name=${nameMatch}, code=${codeMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample component ${sampleComp.id} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateComponentDocuments(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'component_documents',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const docsData = fileData.componentDocuments || {};
  const docsList = Object.values(docsData) as any[];
  result.fileCount = docsList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(componentDocuments);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (docsList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${docsList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleDoc = docsList[0];
      const pgDocs = await db.select().from(componentDocuments);
      const sampleFileKey = sampleDoc.fileKey || sampleDoc.file_key;
      const pgSample = pgDocs.find((d: any) => d.fileKey === sampleFileKey);
      
      if (pgSample) {
        const fileNameMatch = pgSample.fileName === (sampleDoc.fileName || sampleDoc.file_name);
        result.sampleCheck = fileNameMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample document data mismatch for fileKey ${sampleFileKey}: fileName=${fileNameMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample document with fileKey ${sampleFileKey} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateComponentClassRegulatory(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'component_class_regulatory',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const regData = fileData.componentClassRegulatory || {};
  const regList = Object.values(regData) as any[];
  result.fileCount = regList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(componentClassRegulatory);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (regList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${regList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleReg = regList[0];
      const compId = sampleReg.componentId || sampleReg.component_id;
      const pgRegs = await db.select().from(componentClassRegulatory);
      const pgSample = pgRegs.find((r: any) => r.componentId === compId);
      
      if (pgSample) {
        const societyMatch = pgSample.classificationSociety === (sampleReg.classificationSociety || sampleReg.classification_society);
        result.sampleCheck = societyMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample regulatory data mismatch for componentId ${compId}: society=${societyMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample regulatory for componentId ${compId} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateComponentMaintenanceHistory(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'component_maintenance_history',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const histData = fileData.componentMaintenanceHistory || {};
  const histList = Object.values(histData) as any[];
  result.fileCount = histList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(componentMaintenanceHistory);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (histList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${histList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleHist = histList[0];
      const woId = sampleHist.workOrderId || sampleHist.work_order_id;
      const pgHist = await db.select().from(componentMaintenanceHistory);
      const pgSample = pgHist.find((h: any) => h.workOrderId === woId);
      
      if (pgSample) {
        const jobTitleMatch = pgSample.jobTitle === (sampleHist.jobTitle || sampleHist.job_title);
        result.sampleCheck = jobTitleMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample history data mismatch for workOrderId ${woId}: jobTitle=${jobTitleMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample history for workOrderId ${woId} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateComponentRequisitions(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'component_requisitions',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  const reqData = fileData.componentRequisitions || {};
  const reqList = Object.values(reqData) as any[];
  result.fileCount = reqList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(componentRequisitions);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (reqList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${reqList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleReq = reqList[0];
      const reqNo = sampleReq.requisitionNo || sampleReq.requisition_no;
      const pgReqs = await db.select().from(componentRequisitions);
      const pgSample = pgReqs.find((r: any) => r.requisitionNo === reqNo);
      
      if (pgSample) {
        const itemMatch = pgSample.itemOrService === (sampleReq.itemOrService || sampleReq.item_or_service);
        result.sampleCheck = itemMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample requisition data mismatch for ${reqNo}: itemOrService=${itemMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample requisition ${reqNo} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function validateRunningHoursAudit(db: any, fileData: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'running_hours_audit',
    fileCount: 0,
    pgCount: 0,
    countMatch: false,
    sampleCheck: false,
    issues: [],
  };

  // Note: test-data.json uses "runningHoursAudits" (with 's')
  const auditData = fileData.runningHoursAudits || {};
  const auditList = Object.values(auditData) as any[];
  result.fileCount = auditList.length;

  const pgCountResult = await db.select({ count: sql`count(*)` }).from(runningHoursAudit);
  result.pgCount = Number(pgCountResult[0].count);

  result.countMatch = result.pgCount >= result.fileCount;
  if (!result.countMatch && result.fileCount > 0) {
    result.issues.push(`Count mismatch: file=${result.fileCount}, postgres=${result.pgCount}`);
  }

  if (auditList.length > 0) {
    if (result.pgCount === 0) {
      result.issues.push(`Source has ${auditList.length} records but PostgreSQL is empty`);
      result.sampleCheck = false;
    } else {
      const sampleAudit = auditList[0];
      const compId = sampleAudit.componentId || sampleAudit.component_id;
      const pgAudits = await db.select().from(runningHoursAudit);
      const pgSample = pgAudits.find((a: any) => a.componentId === compId);
      
      if (pgSample) {
        const sourceMatch = pgSample.source === (sampleAudit.source || "single");
        result.sampleCheck = sourceMatch;
        if (!result.sampleCheck) {
          result.issues.push(`Sample audit data mismatch for componentId ${compId}: source=${sourceMatch}`);
        }
      } else {
        result.sampleCheck = false;
        result.issues.push(`Sample audit for componentId ${compId} not found in postgres`);
      }
    }
  } else {
    result.sampleCheck = true;
  }

  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 3: Components Data Migration Validation');
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

    results.push(await validateComponents(db, fileData));
    results.push(await validateComponentDocuments(db, fileData));
    results.push(await validateComponentClassRegulatory(db, fileData));
    results.push(await validateComponentMaintenanceHistory(db, fileData));
    results.push(await validateComponentRequisitions(db, fileData));
    results.push(await validateRunningHoursAudit(db, fileData));

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
      console.log('\nModule 3 migration is verified and ready for use.');
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

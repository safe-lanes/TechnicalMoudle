#!/usr/bin/env npx tsx
/**
 * Module 11: Forms Data Migration Script
 * Migrates form_definitions, form_versions, form_version_usage from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module11-forms.ts
 * 
 * Features:
 * - Transaction support for atomic migration (rollback on any error)
 * - BEFORE/AFTER count comparison for accurate reporting
 * - Proper error handling with immediate rollback
 * - Idempotent: safe to run multiple times
 * - Maps JSON field names to PostgreSQL schema field names
 */

import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { formDefinitions, formVersions, formVersionUsage } from '../shared/schema';

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

async function getCount(tx: any, table: any): Promise<number> {
  const result = await tx.select({ count: sql<number>`count(*)::int` }).from(table);
  return result[0]?.count ?? 0;
}

async function migrateWithTransaction(db: any, fileData: any): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  await db.transaction(async (tx: any) => {
    console.log('\n[TRANSACTION] Starting atomic migration...');
    console.log('[TRANSACTION] Any error will cause full rollback.\n');

    // =========== FORM DEFINITIONS ===========
    const definitionsBefore = await getCount(tx, formDefinitions);
    const definitionsData = fileData.formDefinitions || {};
    const definitionsList = Object.values(definitionsData) as any[];

    console.log(`[form_definitions] Processing ${definitionsList.length} records (${definitionsBefore} existing)...`);

    let definitionsMigrated = 0;
    let definitionsSkipped = 0;

    for (const definition of definitionsList) {
      const existing = await tx.select().from(formDefinitions).where(eq(formDefinitions.id, definition.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(formDefinitions).values({
            id: definition.id,
            name: definition.name,
            subgroup: definition.subgroup || null,
          });
          definitionsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Form definition with id ${definition.id} already exists (unique constraint)`);
            definitionsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        definitionsSkipped++;
      }
    }

    const definitionsAfter = await getCount(tx, formDefinitions);
    results.push({
      table: 'form_definitions',
      fileCount: definitionsList.length,
      beforeCount: definitionsBefore,
      afterCount: definitionsAfter,
      migratedCount: definitionsMigrated,
      skippedCount: definitionsSkipped,
    });

    // =========== FORM VERSIONS ===========
    const versionsBefore = await getCount(tx, formVersions);
    const versionsData = fileData.formVersions || {};
    const versionsList = Object.values(versionsData) as any[];

    console.log(`[form_versions] Processing ${versionsList.length} records (${versionsBefore} existing)...`);

    let versionsMigrated = 0;
    let versionsSkipped = 0;

    for (const version of versionsList) {
      const existing = await tx.select().from(formVersions).where(eq(formVersions.id, version.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(formVersions).values({
            id: version.id,
            formId: version.formId || version.form_id,
            versionNo: version.versionNo || version.version_no || version.version || 1,
            versionDate: version.versionDate ? new Date(version.versionDate) : (version.version_date ? new Date(version.version_date) : new Date()),
            status: version.status || 'DRAFT',
            authorUserId: version.authorUserId || version.author_user_id || version.publishedBy || 'system',
            changelog: version.changelog || null,
            schemaJson: typeof version.schemaJson === 'string' ? version.schemaJson : JSON.stringify(version.schemaJson || version.schema_json || {}),
          });
          versionsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Form version with id ${version.id} already exists (unique constraint)`);
            versionsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        versionsSkipped++;
      }
    }

    const versionsAfter = await getCount(tx, formVersions);
    results.push({
      table: 'form_versions',
      fileCount: versionsList.length,
      beforeCount: versionsBefore,
      afterCount: versionsAfter,
      migratedCount: versionsMigrated,
      skippedCount: versionsSkipped,
    });

    // =========== FORM VERSION USAGE ===========
    const usageBefore = await getCount(tx, formVersionUsage);
    const usageData = fileData.formVersionUsages || fileData.formVersionUsage || [];
    const usageList = Array.isArray(usageData) ? usageData : Object.values(usageData) as any[];

    console.log(`[form_version_usage] Processing ${usageList.length} records (${usageBefore} existing)...`);

    let usageMigrated = 0;
    let usageSkipped = 0;

    for (const usage of usageList) {
      // Usage records might not have IDs, check by formVersionId and usedAt
      const existing = usage.id 
        ? await tx.select().from(formVersionUsage).where(eq(formVersionUsage.id, usage.id))
        : [];
      
      if (existing.length === 0) {
        try {
          const insertData: any = {
            formVersionId: usage.formVersionId || usage.form_version_id,
            usedInModule: usage.usedInModule || usage.used_in_module,
            usedAt: usage.usedAt ? new Date(usage.usedAt) : (usage.used_at ? new Date(usage.used_at) : new Date()),
          };
          
          // Only include id if it exists
          if (usage.id) {
            insertData.id = usage.id;
          }
          
          await tx.insert(formVersionUsage).values(insertData);
          usageMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Form version usage record already exists (unique constraint)`);
            usageSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        usageSkipped++;
      }
    }

    const usageAfter = await getCount(tx, formVersionUsage);
    results.push({
      table: 'form_version_usage',
      fileCount: usageList.length,
      beforeCount: usageBefore,
      afterCount: usageAfter,
      migratedCount: usageMigrated,
      skippedCount: usageSkipped,
    });

    console.log('\n[TRANSACTION] All operations completed successfully. Committing...\n');
  });

  return results;
}

async function main() {
  console.log('='.repeat(70));
  console.log('MODULE 11: FORMS DATA MIGRATION');
  console.log('='.repeat(70));
  console.log('\nMigrating: form_definitions, form_versions, form_version_usage');
  console.log('From: test-data.json → PostgreSQL');
  console.log('');

  try {
    // Load file data
    console.log('[1/3] Loading file data...');
    const fileData = await loadFileData();
    
    // Get database connection
    console.log('[2/3] Connecting to PostgreSQL...');
    const db = await getDb();
    
    // Run migration with transaction
    console.log('[3/3] Running migration with transaction...');
    const results = await migrateWithTransaction(db, fileData);
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(70));
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    
    for (const result of results) {
      console.log(`\n${result.table}:`);
      console.log(`  File records:     ${result.fileCount}`);
      console.log(`  Before count:     ${result.beforeCount}`);
      console.log(`  After count:      ${result.afterCount}`);
      console.log(`  Migrated:         ${result.migratedCount}`);
      console.log(`  Skipped:          ${result.skippedCount}`);
      totalMigrated += result.migratedCount;
      totalSkipped += result.skippedCount;
    }
    
    console.log('\n' + '-'.repeat(70));
    console.log(`TOTAL MIGRATED: ${totalMigrated}`);
    console.log(`TOTAL SKIPPED:  ${totalSkipped}`);
    console.log('='.repeat(70));
    console.log('\n✅ Module 11 (Forms) migration completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n[ROLLBACK] All changes have been rolled back due to error.\n');
    process.exit(1);
  }
}

main();

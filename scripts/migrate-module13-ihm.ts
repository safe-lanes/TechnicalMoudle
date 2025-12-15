#!/usr/bin/env npx tsx
/**
 * Module 13: IHM (Inventory of Hazardous Materials) Data Migration Script
 * Migrates ihm_items, ihm_maintenance_log from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module13-ihm.ts
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
import { ihmItems, ihmMaintenanceLog } from '../shared/schema';

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

    // =========== IHM ITEMS ===========
    const itemsBefore = await getCount(tx, ihmItems);
    const itemsData = fileData.ihmItems || {};
    const itemsList = Array.isArray(itemsData) ? itemsData : Object.values(itemsData) as any[];

    console.log(`[ihm_items] Processing ${itemsList.length} records (${itemsBefore} existing)...`);

    let itemsMigrated = 0;
    let itemsSkipped = 0;

    for (const item of itemsList) {
      const existing = await tx.select().from(ihmItems).where(eq(ihmItems.id, item.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(ihmItems).values({
            id: item.id,
            vesselId: item.vesselId || item.vessel_id,
            componentId: item.componentId || item.component_id || null,
            spareId: item.spareId || item.spare_id || null,
            hazardousMaterial: item.hazardousMaterial || item.hazardous_material,
            location: item.location || null,
            quantity: item.quantity || null,
            unit: item.unit || null,
            lastInspectionDate: item.lastInspectionDate ? new Date(item.lastInspectionDate) : (item.last_inspection_date ? new Date(item.last_inspection_date) : null),
            notes: item.notes || null,
          });
          itemsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] IHM item with id ${item.id} already exists (unique constraint)`);
            itemsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        itemsSkipped++;
      }
    }

    const itemsAfter = await getCount(tx, ihmItems);
    results.push({
      table: 'ihm_items',
      fileCount: itemsList.length,
      beforeCount: itemsBefore,
      afterCount: itemsAfter,
      migratedCount: itemsMigrated,
      skippedCount: itemsSkipped,
    });

    // =========== IHM MAINTENANCE LOG ===========
    const logsBefore = await getCount(tx, ihmMaintenanceLog);
    const logsData = fileData.ihmMaintenanceLogs || fileData.ihmMaintenanceLog || {};
    const logsList = Array.isArray(logsData) ? logsData : Object.values(logsData) as any[];

    console.log(`[ihm_maintenance_log] Processing ${logsList.length} records (${logsBefore} existing)...`);

    let logsMigrated = 0;
    let logsSkipped = 0;

    for (const log of logsList) {
      const existing = log.id 
        ? await tx.select().from(ihmMaintenanceLog).where(eq(ihmMaintenanceLog.id, log.id))
        : [];
      
      if (existing.length === 0) {
        try {
          const insertData: any = {
            vesselId: log.vesselId || log.vessel_id,
            componentId: log.componentId || log.component_id || null,
            spareId: log.spareId || log.spare_id || null,
            workOrderId: log.workOrderId || log.work_order_id || null,
            actionType: log.actionType || log.action_type,
            description: log.description || null,
            performedByUserId: log.performedByUserId || log.performed_by_user_id,
          };
          
          if (log.id) {
            insertData.id = log.id;
          }
          
          await tx.insert(ihmMaintenanceLog).values(insertData);
          logsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] IHM maintenance log entry already exists (unique constraint)`);
            logsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        logsSkipped++;
      }
    }

    const logsAfter = await getCount(tx, ihmMaintenanceLog);
    results.push({
      table: 'ihm_maintenance_log',
      fileCount: logsList.length,
      beforeCount: logsBefore,
      afterCount: logsAfter,
      migratedCount: logsMigrated,
      skippedCount: logsSkipped,
    });

    console.log('\n[TRANSACTION] All operations completed successfully. Committing...\n');
  });

  return results;
}

async function main() {
  console.log('='.repeat(70));
  console.log('MODULE 13: IHM (INVENTORY OF HAZARDOUS MATERIALS) DATA MIGRATION');
  console.log('='.repeat(70));
  console.log('\nMigrating: ihm_items, ihm_maintenance_log');
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
    console.log('\n✅ Module 13 (IHM) migration completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n[ROLLBACK] All changes have been rolled back due to error.\n');
    process.exit(1);
  }
}

main();

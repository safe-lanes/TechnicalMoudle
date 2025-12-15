#!/usr/bin/env npx tsx
/**
 * Module 7: Spares Data Migration Script
 * Migrates spares (vessel and fleet) and spares_history from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module7-spares.ts
 * 
 * Features:
 * - Transaction support for atomic migration (rollback on any error)
 * - BEFORE/AFTER count comparison for accurate reporting
 * - Proper error handling with immediate rollback
 * - Idempotent: safe to run multiple times
 * - Handles both vessel spares (dataScope='vessel') and fleet spares (dataScope='fleet')
 * - Migrates spares_history records
 */

import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { spares, sparesHistory } from '../shared/schema';

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

    // ============= SPARES =============
    const sparesBefore = await getCount(tx, spares);

    const vesselSparesData = fileData.spares || {};
    const fleetSparesData = fileData.fleetSpares || {};
    
    const vesselSparesList = Object.values(vesselSparesData) as any[];
    const fleetSparesList = Object.values(fleetSparesData) as any[];
    
    const allSpares = [
      ...vesselSparesList.map(s => ({ ...s, dataScope: s.dataScope || 'vessel' })),
      ...fleetSparesList.map(s => ({ ...s, dataScope: 'fleet' })),
    ];

    console.log(`[spares] Processing ${allSpares.length} records (${vesselSparesList.length} vessel + ${fleetSparesList.length} fleet) (${sparesBefore} existing)...`);

    let sparesMigrated = 0;
    let sparesSkipped = 0;

    for (const spare of allSpares) {
      const existing = await tx.select().from(spares).where(eq(spares.id, spare.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(spares).values({
            id: spare.id,
            vesselId: spare.vesselId || spare.vessel_id || null,
            robId: spare.robId || spare.rob_id || null,
            partName: spare.partName || spare.part_name || '',
            partNumber: spare.partNumber || spare.part_number || null,
            drawingNumber: spare.drawingNumber || spare.drawing_number || null,
            impaCode: spare.impaCode || spare.impa_code || null,
            makerReference: spare.makerReference || spare.maker_reference || null,
            componentCode: spare.componentCode || spare.component_code || null,
            componentName: spare.componentName || spare.component_name || null,
            unit: spare.unit || 'PCS',
            location1: spare.location1 || null,
            location2: spare.location2 || null,
            quantityLocation1: spare.quantityLocation1 ?? spare.quantity_location_1 ?? 0,
            quantityLocation2: spare.quantityLocation2 ?? spare.quantity_location_2 ?? 0,
            totalQuantity: spare.totalQuantity ?? spare.total_quantity ?? 0,
            minimumQuantity: spare.minimumQuantity ?? spare.minimum_quantity ?? 0,
            maximumQuantity: spare.maximumQuantity ?? spare.maximum_quantity ?? 0,
            reorderLevel: spare.reorderLevel ?? spare.reorder_level ?? null,
            unitCost: spare.unitCost ?? spare.unit_cost ?? null,
            currency: spare.currency || null,
            supplier: spare.supplier || null,
            leadTimeDays: spare.leadTimeDays ?? spare.lead_time_days ?? null,
            lastOrderDate: spare.lastOrderDate || spare.last_order_date || null,
            lastReceivedDate: spare.lastReceivedDate || spare.last_received_date || null,
            expiryDate: spare.expiryDate || spare.expiry_date || null,
            certificationRequired: spare.certificationRequired ?? spare.certification_required ?? false,
            criticalSpare: spare.criticalSpare ?? spare.critical_spare ?? false,
            remarks: spare.remarks || null,
            dataScope: spare.dataScope || 'vessel',
            fleetEquipmentCode: spare.fleetEquipmentCode || spare.fleet_equipment_code || null,
            sfiCode: spare.sfiCode || spare.sfi_code || null,
            isActive: spare.isActive !== false,
            createdAt: spare.createdAt ? new Date(spare.createdAt) : new Date(),
            updatedAt: spare.updatedAt ? new Date(spare.updatedAt) : new Date(),
          });
          sparesMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Spare with robId "${spare.robId}" already exists (unique constraint)`);
            sparesSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        sparesSkipped++;
      }
    }

    const sparesAfter = await getCount(tx, spares);
    results.push({
      table: 'spares',
      fileCount: allSpares.length,
      beforeCount: sparesBefore,
      afterCount: sparesAfter,
      migratedCount: sparesMigrated,
      skippedCount: sparesSkipped,
    });
    console.log(`[spares] Done: ${sparesMigrated} migrated, ${sparesSkipped} skipped`);

    // ============= SPARES HISTORY =============
    const historyBefore = await getCount(tx, sparesHistory);

    const historyData = fileData.sparesHistory || {};
    const historyList = Object.values(historyData) as any[];

    console.log(`[spares_history] Processing ${historyList.length} records (${historyBefore} existing)...`);

    let historyMigrated = 0;
    let historySkipped = 0;

    for (const history of historyList) {
      const existing = await tx.select().from(sparesHistory).where(eq(sparesHistory.id, history.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(sparesHistory).values({
            id: history.id,
            spareId: history.spareId || history.spare_id,
            vesselId: history.vesselId || history.vessel_id || null,
            transactionType: history.transactionType || history.transaction_type || 'adjustment',
            quantity: history.quantity ?? 0,
            previousQuantity: history.previousQuantity ?? history.previous_quantity ?? null,
            newQuantity: history.newQuantity ?? history.new_quantity ?? null,
            location: history.location || null,
            workOrderId: history.workOrderId || history.work_order_id || null,
            poNumber: history.poNumber || history.po_number || null,
            notes: history.notes || null,
            performedBy: history.performedBy || history.performed_by || null,
            transactionDate: history.transactionDate || history.transaction_date ? 
              new Date(history.transactionDate || history.transaction_date) : new Date(),
            createdAt: history.createdAt ? new Date(history.createdAt) : new Date(),
          });
          historyMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Spare history record already exists (unique constraint)`);
            historySkipped++;
          } else {
            throw error;
          }
        }
      } else {
        historySkipped++;
      }
    }

    const historyAfter = await getCount(tx, sparesHistory);
    results.push({
      table: 'spares_history',
      fileCount: historyList.length,
      beforeCount: historyBefore,
      afterCount: historyAfter,
      migratedCount: historyMigrated,
      skippedCount: historySkipped,
    });
    console.log(`[spares_history] Done: ${historyMigrated} migrated, ${historySkipped} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 7: Spares Data Migration');
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

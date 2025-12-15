#!/usr/bin/env npx tsx
/**
 * Module 8: Stores Data Migration Script
 * Migrates stores_items and stores_ledger from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module8-stores.ts
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
import { storesItems, storesLedger } from '../shared/schema';

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

    // =========== STORES ITEMS ===========
    const storesItemsBefore = await getCount(tx, storesItems);
    const storesItemsData = fileData.storesItems || {};
    const storesItemsList = Object.values(storesItemsData) as any[];

    console.log(`[stores_items] Processing ${storesItemsList.length} records (${storesItemsBefore} existing)...`);

    let storesItemsMigrated = 0;
    let storesItemsSkipped = 0;

    for (const item of storesItemsList) {
      const existing = await tx.select().from(storesItems).where(eq(storesItems.id, item.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(storesItems).values({
            id: item.id,
            vesselId: item.vesselId || item.vessel_id,
            itemType: item.itemType || item.item_type || 'stores',
            itemCode: item.itemCode || item.item_code || item.partCode || `ITEM-${item.id}`,
            impaCode: item.impaCode || item.impa_code || null,
            itemName: item.itemName || item.item_name || item.name || 'Unknown Item',
            category: item.category || item.storesCategory || null,
            specification: item.specification || item.applicationArea || null,
            uom: item.uom || null,
            rob: item.rob?.toString() || '0',
            robLocationA: item.robLocationA?.toString() || item.rob_location_a?.toString() || '0',
            robLocationB: item.robLocationB?.toString() || item.rob_location_b?.toString() || '0',
            locationA: item.locationA || item.location_a || null,
            locationB: item.locationB || item.location_b || null,
            min: item.min?.toString() || '0',
            max: item.max?.toString() || null,
            unitCost: item.unitCost?.toString() || item.unit_cost?.toString() || null,
            supplier: item.supplier || null,
            lastOrderDate: item.lastOrderDate || item.last_order_date || null,
            leadTime: item.leadTime || item.lead_time || null,
            ihm: item.ihm || false,
            ihmDetails: item.ihmDetails || item.ihm_details || null,
            remarks: item.remarks || null,
            deleted: item.deleted || false,
            isActive: item.isActive !== false,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          });
          storesItemsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Stores item with id ${item.id} already exists (unique constraint)`);
            storesItemsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        storesItemsSkipped++;
      }
    }

    const storesItemsAfter = await getCount(tx, storesItems);
    results.push({
      table: 'stores_items',
      fileCount: storesItemsList.length,
      beforeCount: storesItemsBefore,
      afterCount: storesItemsAfter,
      migratedCount: storesItemsMigrated,
      skippedCount: storesItemsSkipped,
    });
    console.log(`[stores_items] Done: ${storesItemsMigrated} migrated, ${storesItemsSkipped} skipped`);

    // =========== STORES LEDGER ===========
    const storesLedgerBefore = await getCount(tx, storesLedger);
    const storesLedgerData = fileData.storesLedger || {};
    const storesLedgerList = Object.values(storesLedgerData) as any[];

    console.log(`[stores_ledger] Processing ${storesLedgerList.length} records (${storesLedgerBefore} existing)...`);

    let storesLedgerMigrated = 0;
    let storesLedgerSkipped = 0;

    for (const ledger of storesLedgerList) {
      const existing = await tx.select().from(storesLedger).where(eq(storesLedger.id, ledger.id));
      
      if (existing.length === 0) {
        try {
          // Look up the stores item to get itemName and partCode
          let itemName = 'Unknown Item';
          let partCode = `ITEM-${ledger.storesItemId || ledger.itemId}`;
          let uom = null;
          let section = 'stores';
          let vesselId = ledger.vesselId || '';
          
          if (ledger.storesItemId || ledger.itemId) {
            const itemId = ledger.storesItemId || ledger.itemId;
            const storeItem = storesItemsList.find((i: any) => i.id === itemId);
            if (storeItem) {
              itemName = storeItem.itemName || storeItem.item_name || itemName;
              partCode = storeItem.itemCode || storeItem.item_code || storeItem.partCode || partCode;
              uom = storeItem.uom || null;
              section = storeItem.itemType || storeItem.item_type || 'stores';
              vesselId = storeItem.vesselId || storeItem.vessel_id || vesselId;
            }
          }

          // Map transactionType to eventType
          const eventTypeMap: Record<string, string> = {
            'consume': 'CONSUME',
            'receive': 'RECEIVE',
            'adjust': 'ADJUST',
            'transfer_in': 'TRANSFER_IN',
            'transfer_out': 'TRANSFER_OUT',
            'archive': 'ARCHIVE',
          };
          const eventType = eventTypeMap[ledger.transactionType?.toLowerCase()] || 
                           ledger.eventType || 
                           ledger.transactionType?.toUpperCase() || 
                           'ADJUST';

          await tx.insert(storesLedger).values({
            id: ledger.id,
            vesselId: vesselId,
            section: section,
            itemId: ledger.storesItemId || ledger.itemId,
            partCode: partCode,
            itemName: itemName,
            uom: uom,
            eventType: eventType,
            qtyChangeBase: ledger.quantity?.toString() || ledger.qtyChangeBase?.toString() || '0',
            qtyDisplay: ledger.quantity?.toString() || ledger.qtyDisplay?.toString() || '0',
            uomDisplay: ledger.uomDisplay || uom || null,
            robAfterBase: ledger.robAfter?.toString() || ledger.robAfterBase?.toString() || '0',
            dateLocal: ledger.dateLocal || new Date().toISOString().split('T')[0],
            tz: ledger.tz || 'UTC',
            timestampUTC: ledger.createdAt ? new Date(ledger.createdAt) : new Date(),
            place: ledger.place || null,
            ref: ledger.ref || ledger.reference || null,
            userId: ledger.createdBy || ledger.userId || 'system',
            remarks: ledger.remarks || ledger.reason || null,
          });
          storesLedgerMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Stores ledger with id ${ledger.id} already exists (unique constraint)`);
            storesLedgerSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        storesLedgerSkipped++;
      }
    }

    const storesLedgerAfter = await getCount(tx, storesLedger);
    results.push({
      table: 'stores_ledger',
      fileCount: storesLedgerList.length,
      beforeCount: storesLedgerBefore,
      afterCount: storesLedgerAfter,
      migratedCount: storesLedgerMigrated,
      skippedCount: storesLedgerSkipped,
    });
    console.log(`[stores_ledger] Done: ${storesLedgerMigrated} migrated, ${storesLedgerSkipped} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 8: Stores Data Migration');
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

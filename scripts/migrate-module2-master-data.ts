#!/usr/bin/env npx tsx
/**
 * Module 2: Master Data Migration Script
 * Migrates makers, master_lists, maker_list, sfi_details, master_data from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module2-master-data.ts
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
  makers,
  masterLists,
  makerList,
  sfiDetails,
  masterData,
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
    const makersBefore = await getCount(tx, makers);
    const masterListsBefore = await getCount(tx, masterLists);
    const makerListBefore = await getCount(tx, makerList);
    const sfiDetailsBefore = await getCount(tx, sfiDetails);
    const masterDataBefore = await getCount(tx, masterData);

    // 1. Migrate Makers (no dependencies)
    const makersData = fileData.makers || {};
    const makersList = Object.values(makersData) as any[];
    console.log(`[makers] Processing ${makersList.length} records (${makersBefore} existing)...`);

    for (const maker of makersList) {
      const existing = await tx.select().from(makers).where(eq(makers.id, maker.id));
      if (existing.length === 0) {
        await tx.insert(makers).values({
          id: maker.id,
          makerCode: maker.makerCode || maker.maker_code,
          makerName: maker.makerName || maker.maker_name,
          address: maker.address || null,
          addressId: maker.addressId || maker.address_id || null,
          createdAt: maker.createdAt ? new Date(maker.createdAt) : new Date(),
          updatedAt: maker.updatedAt ? new Date(maker.updatedAt) : new Date(),
        });
      }
    }
    const makersAfter = await getCount(tx, makers);
    results.push({
      table: 'makers',
      fileCount: makersList.length,
      beforeCount: makersBefore,
      afterCount: makersAfter,
      migratedCount: makersAfter - makersBefore,
      skippedCount: makersList.length - (makersAfter - makersBefore),
    });
    console.log(`[makers] Done: ${makersAfter - makersBefore} migrated, ${makersList.length - (makersAfter - makersBefore)} skipped`);

    // 2. Migrate Master Lists (no dependencies)
    const masterListsData = fileData.masterLists || {};
    const masterListsList = Object.values(masterListsData) as any[];
    console.log(`\n[master_lists] Processing ${masterListsList.length} records (${masterListsBefore} existing)...`);

    for (const list of masterListsList) {
      const existing = await tx.select().from(masterLists).where(eq(masterLists.id, list.id));
      if (existing.length === 0) {
        await tx.insert(masterLists).values({
          id: list.id,
          listType: list.listType || list.list_type,
          listKey: list.listKey || list.list_key,
          listValue: list.listValue || list.list_value,
          displayOrder: list.displayOrder ?? list.display_order ?? 0,
          isActive: list.isActive !== false,
          createdAt: list.createdAt ? new Date(list.createdAt) : new Date(),
        });
      }
    }
    const masterListsAfter = await getCount(tx, masterLists);
    results.push({
      table: 'master_lists',
      fileCount: masterListsList.length,
      beforeCount: masterListsBefore,
      afterCount: masterListsAfter,
      migratedCount: masterListsAfter - masterListsBefore,
      skippedCount: masterListsList.length - (masterListsAfter - masterListsBefore),
    });
    console.log(`[master_lists] Done: ${masterListsAfter - masterListsBefore} migrated, ${masterListsList.length - (masterListsAfter - masterListsBefore)} skipped`);

    // 3. Migrate Maker List (no dependencies)
    const makerListData = fileData.makerList || {};
    const makerListList = Object.values(makerListData) as any[];
    console.log(`\n[maker_list] Processing ${makerListList.length} records (${makerListBefore} existing)...`);

    for (const item of makerListList) {
      const existing = await tx.select().from(makerList).where(eq(makerList.id, item.id));
      if (existing.length === 0) {
        await tx.insert(makerList).values({
          id: item.id,
          makerCode: item.makerCode || item.maker_code,
          makerName: item.makerName || item.maker_name,
          address: item.address || null,
          addressId: item.addressId || item.address_id || null,
          isActive: item.isActive !== false,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        });
      }
    }
    const makerListAfter = await getCount(tx, makerList);
    results.push({
      table: 'maker_list',
      fileCount: makerListList.length,
      beforeCount: makerListBefore,
      afterCount: makerListAfter,
      migratedCount: makerListAfter - makerListBefore,
      skippedCount: makerListList.length - (makerListAfter - makerListBefore),
    });
    console.log(`[maker_list] Done: ${makerListAfter - makerListBefore} migrated, ${makerListList.length - (makerListAfter - makerListBefore)} skipped`);

    // 4. Migrate SFI Details (no dependencies)
    const sfiDetailsData = fileData.sfiDetails || {};
    const sfiDetailsList = Object.values(sfiDetailsData) as any[];
    console.log(`\n[sfi_details] Processing ${sfiDetailsList.length} records (${sfiDetailsBefore} existing)...`);

    for (const sfi of sfiDetailsList) {
      const existing = await tx.select().from(sfiDetails).where(eq(sfiDetails.id, sfi.id));
      if (existing.length === 0) {
        await tx.insert(sfiDetails).values({
          id: sfi.id,
          componentCode: sfi.componentCode || sfi.component_code,
          componentName: sfi.componentName || sfi.component_name,
          description: sfi.description || null,
          isActive: sfi.isActive !== false,
          createdAt: sfi.createdAt ? new Date(sfi.createdAt) : new Date(),
          updatedAt: sfi.updatedAt ? new Date(sfi.updatedAt) : new Date(),
        });
      }
    }
    const sfiDetailsAfter = await getCount(tx, sfiDetails);
    results.push({
      table: 'sfi_details',
      fileCount: sfiDetailsList.length,
      beforeCount: sfiDetailsBefore,
      afterCount: sfiDetailsAfter,
      migratedCount: sfiDetailsAfter - sfiDetailsBefore,
      skippedCount: sfiDetailsList.length - (sfiDetailsAfter - sfiDetailsBefore),
    });
    console.log(`[sfi_details] Done: ${sfiDetailsAfter - sfiDetailsBefore} migrated, ${sfiDetailsList.length - (sfiDetailsAfter - sfiDetailsBefore)} skipped`);

    // 5. Migrate Master Data (depends on makers/sfi for referential integrity, but no FK constraints)
    const masterDataData = fileData.masterData || {};
    const masterDataList = Object.values(masterDataData) as any[];
    console.log(`\n[master_data] Processing ${masterDataList.length} records (${masterDataBefore} existing)...`);

    for (const data of masterDataList) {
      const existing = await tx.select().from(masterData).where(eq(masterData.id, data.id));
      if (existing.length === 0) {
        await tx.insert(masterData).values({
          id: data.id,
          slNo: data.slNo ?? data.sl_no ?? null,
          makerName: data.makerName || data.maker_name,
          makerCode: data.makerCode || data.maker_code,
          countMaker: data.countMaker ?? data.count_maker ?? null,
          model: data.model,
          modelCode: data.modelCode || data.model_code,
          countSfiCode: data.countSfiCode ?? data.count_sfi_code ?? null,
          fleetEquipmentCode: data.fleetEquipmentCode || data.fleet_equipment_code,
          sfiCode: data.sfiCode || data.sfi_code,
          assignedSubCode: data.assignedSubCode ?? data.assigned_sub_code ?? null,
          vesselName: data.vesselName ?? data.vessel_name ?? null,
          vesselCode: data.vesselCode ?? data.vessel_code ?? null,
          equipmentName: data.equipmentName || data.equipment_name,
          isActive: data.isActive !== false,
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
        });
      }
    }
    const masterDataAfter = await getCount(tx, masterData);
    results.push({
      table: 'master_data',
      fileCount: masterDataList.length,
      beforeCount: masterDataBefore,
      afterCount: masterDataAfter,
      migratedCount: masterDataAfter - masterDataBefore,
      skippedCount: masterDataList.length - (masterDataAfter - masterDataBefore),
    });
    console.log(`[master_data] Done: ${masterDataAfter - masterDataBefore} migrated, ${masterDataList.length - (masterDataAfter - masterDataBefore)} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 2: Master Data Migration');
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

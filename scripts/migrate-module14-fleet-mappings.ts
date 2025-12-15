/**
 * Module 14 Migration Script: Fleet Mappings
 * 
 * Migrates data from test-data.json to PostgreSQL for:
 * - fleet_vessel_mapping
 * - fleet_component_mapping
 * - fleet_job_vessel_mapping
 * - fleet_spare_vessel_mapping
 * 
 * Usage: npx tsx scripts/migrate-module14-fleet-mappings.ts
 */

import { getDb } from '../server/db';
import { 
  fleetVesselMapping,
  fleetComponentMapping,
  fleetJobVesselMapping,
  fleetSpareVesselMapping
} from '../shared/schema';
import * as fs from 'fs';
import * as path from 'path';

interface FileData {
  fleetVesselMappings?: Record<string, any>;
  fleetComponentMappings?: Record<string, any>;
  fleetJobVesselMappings?: Record<string, any>;
  fleetSpareVesselMappings?: Record<string, any>;
}

async function loadFileData(): Promise<FileData> {
  const filePath = path.join(process.cwd(), 'test-data.json');
  if (!fs.existsSync(filePath)) {
    console.log('📄 No test-data.json found, skipping file data load');
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

async function migrateFleetVesselMappings(db: any, data: FileData): Promise<number> {
  const mappings = data.fleetVesselMappings || {};
  const records = Object.values(mappings).filter((m: any) => m.isActive !== false);
  
  if (records.length === 0) {
    console.log('  ⚪ No fleet vessel mappings to migrate');
    return 0;
  }

  let migrated = 0;
  for (const record of records) {
    try {
      await db.insert(fleetVesselMapping).values({
        fleetEquipmentCode: record.fleetEquipmentCode,
        vesselCode: record.vesselCode,
        vesselName: record.vesselName || null,
        mappedBy: record.mappedBy || 'system',
        isActive: record.isActive ?? true,
      }).onConflictDoNothing();
      migrated++;
    } catch (error: any) {
      if (!error.message?.includes('duplicate')) {
        console.error(`  ⚠️ Error migrating fleet vessel mapping: ${error.message}`);
      }
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} fleet vessel mappings`);
  return migrated;
}

async function migrateFleetComponentMappings(db: any, data: FileData): Promise<number> {
  const mappings = data.fleetComponentMappings || {};
  const records = Object.values(mappings).filter((m: any) => m.isActive !== false);
  
  if (records.length === 0) {
    console.log('  ⚪ No fleet component mappings to migrate');
    return 0;
  }

  let migrated = 0;
  for (const record of records) {
    try {
      await db.insert(fleetComponentMapping).values({
        fleetEquipmentCode: record.fleetEquipmentCode,
        vesselCode: record.vesselCode,
        componentCode: record.componentCode,
        componentId: record.componentId || null,
        componentName: record.componentName || null,
        mappedBy: record.mappedBy || 'system',
        isActive: record.isActive ?? true,
      }).onConflictDoNothing();
      migrated++;
    } catch (error: any) {
      if (!error.message?.includes('duplicate')) {
        console.error(`  ⚠️ Error migrating fleet component mapping: ${error.message}`);
      }
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} fleet component mappings`);
  return migrated;
}

async function migrateFleetJobVesselMappings(db: any, data: FileData): Promise<number> {
  const mappings = data.fleetJobVesselMappings || {};
  const records = Object.values(mappings).filter((m: any) => m.isActive !== false);
  
  if (records.length === 0) {
    console.log('  ⚪ No fleet job vessel mappings to migrate');
    return 0;
  }

  let migrated = 0;
  for (const record of records) {
    try {
      await db.insert(fleetJobVesselMapping).values({
        fleetEquipmentCode: record.fleetEquipmentCode,
        jobCode: record.jobCode,
        jobId: record.jobId || null,
        vesselCode: record.vesselCode,
        vesselName: record.vesselName || null,
        mappedBy: record.mappedBy || 'system',
        isActive: record.isActive ?? true,
      }).onConflictDoNothing();
      migrated++;
    } catch (error: any) {
      if (!error.message?.includes('duplicate')) {
        console.error(`  ⚠️ Error migrating fleet job vessel mapping: ${error.message}`);
      }
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} fleet job vessel mappings`);
  return migrated;
}

async function migrateFleetSpareVesselMappings(db: any, data: FileData): Promise<number> {
  const mappings = data.fleetSpareVesselMappings || {};
  const records = Object.values(mappings).filter((m: any) => m.isActive !== false);
  
  if (records.length === 0) {
    console.log('  ⚪ No fleet spare vessel mappings to migrate');
    return 0;
  }

  let migrated = 0;
  for (const record of records) {
    try {
      await db.insert(fleetSpareVesselMapping).values({
        fleetEquipmentCode: record.fleetEquipmentCode,
        partCode: record.partCode,
        spareId: record.spareId || null,
        vesselCode: record.vesselCode,
        vesselName: record.vesselName || null,
        mappedBy: record.mappedBy || 'system',
        isActive: record.isActive ?? true,
      }).onConflictDoNothing();
      migrated++;
    } catch (error: any) {
      if (!error.message?.includes('duplicate')) {
        console.error(`  ⚠️ Error migrating fleet spare vessel mapping: ${error.message}`);
      }
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} fleet spare vessel mappings`);
  return migrated;
}

async function main() {
  console.log('🚀 Starting Module 14 Migration: Fleet Mappings');
  console.log('================================================\n');

  try {
    const db = await getDb();
    const data = await loadFileData();

    console.log('📊 Migrating Fleet Vessel Mappings...');
    await migrateFleetVesselMappings(db, data);

    console.log('\n📊 Migrating Fleet Component Mappings...');
    await migrateFleetComponentMappings(db, data);

    console.log('\n📊 Migrating Fleet Job Vessel Mappings...');
    await migrateFleetJobVesselMappings(db, data);

    console.log('\n📊 Migrating Fleet Spare Vessel Mappings...');
    await migrateFleetSpareVesselMappings(db, data);

    console.log('\n================================================');
    console.log('✅ Module 14 Migration Complete!');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();

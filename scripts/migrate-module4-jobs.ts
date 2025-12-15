#!/usr/bin/env npx tsx
/**
 * Module 4: Jobs Data Migration Script
 * Migrates jobs (vessel and fleet) from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module4-jobs.ts
 * 
 * Features:
 * - Transaction support for atomic migration (rollback on any error)
 * - BEFORE/AFTER count comparison for accurate reporting
 * - Proper error handling with immediate rollback
 * - Idempotent: safe to run multiple times
 * - Handles both vessel jobs (dataScope='vessel') and fleet jobs (dataScope='fleet')
 */

import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { jobs } from '../shared/schema';

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

    // Get BEFORE count
    const jobsBefore = await getCount(tx, jobs);

    // Collect all jobs (vessel + fleet)
    const vesselJobsData = fileData.jobs || {};
    const fleetJobsData = fileData.fleetJobs || {};
    
    const vesselJobsList = Object.values(vesselJobsData) as any[];
    const fleetJobsList = Object.values(fleetJobsData) as any[];
    
    const allJobs = [
      ...vesselJobsList.map(j => ({ ...j, dataScope: j.dataScope || 'vessel' })),
      ...fleetJobsList.map(j => ({ ...j, dataScope: 'fleet' })),
    ];

    console.log(`[jobs] Processing ${allJobs.length} records (${vesselJobsList.length} vessel + ${fleetJobsList.length} fleet) (${jobsBefore} existing)...`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const job of allJobs) {
      // Check if job already exists by ID
      const existing = await tx.select().from(jobs).where(eq(jobs.id, job.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(jobs).values({
            id: job.id,
            vesselId: job.vesselId || job.vessel_id || null,
            componentId: job.componentId || job.component_id,
            componentCode: job.componentCode || job.component_code,
            componentName: job.componentName || job.component_name,
            jobNo: job.jobNo || job.job_no,
            jobTitle: job.jobTitle || job.job_title,
            assignedTo: job.assignedTo || job.assigned_to || null,
            maintenanceType: job.maintenanceType || job.maintenance_type || null,
            maintenanceBasis: job.maintenanceBasis || job.maintenance_basis || null,
            frequencyType: job.frequencyType || job.frequency_type || null,
            frequencyValue: job.frequencyValue || job.frequency_value || null,
            frequencyUnit: job.frequencyUnit || job.frequency_unit || null,
            intervalRunningHour: job.intervalRunningHour ?? job.interval_running_hour ?? job.internalRunningHourNumber ?? null,
            leadTimeValue: job.leadTimeValue ?? job.lead_time_value ?? null,
            leadTimeUnit: job.leadTimeUnit || job.lead_time_unit || null,
            initialNextDue: job.initialNextDue || job.initial_next_due || null,
            lastDoneDate: job.lastDoneDate || job.last_done_date || null,
            nextDueDate: job.nextDueDate || job.next_due_date || null,
            lastDoneRH: job.lastDoneRH || job.last_done_rh || null,
            nextDueRH: job.nextDueRH || job.next_due_rh || null,
            jobPriority: job.jobPriority || job.job_priority || null,
            classRelated: job.classRelated || job.class_related || null,
            briefWorkDescription: job.briefWorkDescription || job.brief_work_description || null,
            jobDescription: job.jobDescription || job.job_description || null,
            approver: job.approver || null,
            department: job.department || null,
            requiredSpareParts: job.requiredSpareParts || job.required_spare_parts || [],
            requiredTools: job.requiredTools || job.required_tools || [],
            safetyRequirements: job.safetyRequirements || job.safety_requirements || { ppeRequirements: [], permitRequirements: [], otherRequirements: [] },
            dataScope: job.dataScope || 'vessel',
            fleetEquipmentCode: job.fleetEquipmentCode || job.fleet_equipment_code || null,
            fleetJobCode: job.fleetJobCode || job.fleet_job_code || null,
            sfiCode: job.sfiCode || job.sfi_code || null,
            criticality: job.criticality || null,
            isActive: job.isActive !== false,
            estimatedManHours: job.estimatedManHours || job.estimated_man_hours || null,
            createdBy: job.createdBy || job.created_by || null,
            createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
            updatedBy: job.updatedBy || job.updated_by || null,
            updatedAt: job.updatedAt ? new Date(job.updatedAt) : new Date(),
          });
          migratedCount++;
        } catch (error: any) {
          // Check for unique constraint violation on jobNo
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Job with jobNo "${job.jobNo}" already exists (unique constraint)`);
            skippedCount++;
          } else {
            throw error;
          }
        }
      } else {
        skippedCount++;
      }
    }

    const jobsAfter = await getCount(tx, jobs);
    results.push({
      table: 'jobs',
      fileCount: allJobs.length,
      beforeCount: jobsBefore,
      afterCount: jobsAfter,
      migratedCount: migratedCount,
      skippedCount: skippedCount,
    });
    console.log(`[jobs] Done: ${migratedCount} migrated, ${skippedCount} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 4: Jobs Data Migration');
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

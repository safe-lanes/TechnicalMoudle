#!/usr/bin/env npx tsx
/**
 * Module 5: Work Orders Data Migration Script
 * Migrates work_orders (vessel and fleet) from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module5-workorders.ts
 * 
 * Features:
 * - Transaction support for atomic migration (rollback on any error)
 * - BEFORE/AFTER count comparison for accurate reporting
 * - Proper error handling with immediate rollback
 * - Idempotent: safe to run multiple times
 * - Handles both vessel work orders (dataScope='vessel') and fleet work orders (dataScope='fleet')
 */

import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { workOrders } from '../shared/schema';

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
    const workOrdersBefore = await getCount(tx, workOrders);

    // Collect all work orders (vessel + fleet)
    const vesselWorkOrdersData = fileData.workOrders || {};
    const fleetWorkOrdersData = fileData.fleetWorkOrders || {};
    
    const vesselWorkOrdersList = Object.values(vesselWorkOrdersData) as any[];
    const fleetWorkOrdersList = Object.values(fleetWorkOrdersData) as any[];
    
    const allWorkOrders = [
      ...vesselWorkOrdersList.map(wo => ({ ...wo, dataScope: wo.dataScope || 'vessel' })),
      ...fleetWorkOrdersList.map(wo => ({ ...wo, dataScope: 'fleet' })),
    ];

    console.log(`[work_orders] Processing ${allWorkOrders.length} records (${vesselWorkOrdersList.length} vessel + ${fleetWorkOrdersList.length} fleet) (${workOrdersBefore} existing)...`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const wo of allWorkOrders) {
      // Check if work order already exists by ID
      const existing = await tx.select().from(workOrders).where(eq(workOrders.id, wo.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(workOrders).values({
            id: wo.id,
            vesselId: wo.vesselId || wo.vessel_id || null,
            component: wo.component || null,
            componentCode: wo.componentCode || wo.component_code || null,
            jobId: wo.jobId || wo.job_id || null,
            jobNo: wo.jobNo || wo.job_no || null,
            templateId: wo.templateId || wo.template_id || null,
            workOrderNo: wo.workOrderNo || wo.work_order_no,
            workOrderType: wo.workOrderType || wo.work_order_type || 'Planned',
            status: wo.status || 'Open',
            assignedTo: wo.assignedTo || wo.assigned_to || null,
            department: wo.department || null,
            maintenanceType: wo.maintenanceType || wo.maintenance_type || null,
            maintenanceBasis: wo.maintenanceBasis || wo.maintenance_basis || null,
            frequencyType: wo.frequencyType || wo.frequency_type || null,
            frequencyValue: wo.frequencyValue || wo.frequency_value || null,
            frequencyUnit: wo.frequencyUnit || wo.frequency_unit || null,
            runningHourInterval: wo.runningHourInterval ?? wo.running_hour_interval ?? null,
            leadTimeValue: wo.leadTimeValue ?? wo.lead_time_value ?? null,
            leadTimeUnit: wo.leadTimeUnit || wo.lead_time_unit || null,
            lastDoneDate: wo.lastDoneDate || wo.last_done_date || null,
            nextDueDate: wo.nextDueDate || wo.next_due_date || null,
            dueDate: wo.dueDate || wo.due_date || null,
            lastDoneRH: wo.lastDoneRH || wo.last_done_rh || null,
            nextDueRH: wo.nextDueRH || wo.next_due_rh || null,
            currentReading: wo.currentReading || wo.current_reading || null,
            nextDueReading: wo.nextDueReading || wo.next_due_reading || null,
            priority: wo.priority || null,
            classRelated: wo.classRelated || wo.class_related || null,
            briefWorkDescription: wo.briefWorkDescription || wo.brief_work_description || null,
            jobDescription: wo.jobDescription || wo.job_description || null,
            requiredSpareParts: wo.requiredSpareParts || wo.required_spare_parts || [],
            requiredTools: wo.requiredTools || wo.required_tools || [],
            safetyRequirements: wo.safetyRequirements || wo.safety_requirements || null,
            approver: wo.approver || null,
            approverDepartment: wo.approverDepartment || wo.approver_department || null,
            estimatedManHours: wo.estimatedManHours || wo.estimated_man_hours || null,
            actualManHours: wo.actualManHours || wo.actual_man_hours || null,
            remarks: wo.remarks || null,
            completionDate: wo.completionDate || wo.completion_date || null,
            completedBy: wo.completedBy || wo.completed_by || null,
            verifiedBy: wo.verifiedBy || wo.verified_by || null,
            verificationDate: wo.verificationDate || wo.verification_date || null,
            closedBy: wo.closedBy || wo.closed_by || null,
            closedDate: wo.closedDate || wo.closed_date || null,
            postponedReason: wo.postponedReason || wo.postponed_reason || null,
            postponedUntil: wo.postponedUntil || wo.postponed_until || null,
            postponedBy: wo.postponedBy || wo.postponed_by || null,
            postponedDate: wo.postponedDate || wo.postponed_date || null,
            isOverdue: wo.isOverdue || wo.is_overdue || false,
            dataScope: wo.dataScope || 'vessel',
            fleetEquipmentCode: wo.fleetEquipmentCode || wo.fleet_equipment_code || null,
            sfiCode: wo.sfiCode || wo.sfi_code || null,
            isActive: wo.isActive !== false,
            createdBy: wo.createdBy || wo.created_by || null,
            createdAt: wo.createdAt ? new Date(wo.createdAt) : new Date(),
            updatedBy: wo.updatedBy || wo.updated_by || null,
            updatedAt: wo.updatedAt ? new Date(wo.updatedAt) : new Date(),
          });
          migratedCount++;
        } catch (error: any) {
          // Check for unique constraint violation on workOrderNo
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Work order with workOrderNo "${wo.workOrderNo}" already exists (unique constraint)`);
            skippedCount++;
          } else {
            throw error;
          }
        }
      } else {
        skippedCount++;
      }
    }

    const workOrdersAfter = await getCount(tx, workOrders);
    results.push({
      table: 'work_orders',
      fileCount: allWorkOrders.length,
      beforeCount: workOrdersBefore,
      afterCount: workOrdersAfter,
      migratedCount: migratedCount,
      skippedCount: skippedCount,
    });
    console.log(`[work_orders] Done: ${migratedCount} migrated, ${skippedCount} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 5: Work Orders Data Migration');
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

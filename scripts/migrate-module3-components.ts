#!/usr/bin/env npx tsx
/**
 * Module 3: Components Data Migration Script
 * Migrates components, component_documents, component_class_regulatory,
 * component_maintenance_history, component_requisitions, running_hours_audit from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module3-components.ts
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
  components,
  componentDocuments,
  componentClassRegulatory,
  componentMaintenanceHistory,
  componentRequisitions,
  runningHoursAudit,
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
    const componentsBefore = await getCount(tx, components);
    const componentDocsBefore = await getCount(tx, componentDocuments);
    const componentClassRegBefore = await getCount(tx, componentClassRegulatory);
    const componentMaintHistBefore = await getCount(tx, componentMaintenanceHistory);
    const componentReqsBefore = await getCount(tx, componentRequisitions);
    const rhAuditBefore = await getCount(tx, runningHoursAudit);

    // 1. Migrate Components (base table, no dependencies)
    const componentsData = fileData.components || {};
    const componentsList = Object.values(componentsData) as any[];
    console.log(`[components] Processing ${componentsList.length} records (${componentsBefore} existing)...`);

    for (const comp of componentsList) {
      const existing = await tx.select().from(components).where(eq(components.id, comp.id));
      if (existing.length === 0) {
        await tx.insert(components).values({
          id: comp.id,
          name: comp.name || null,
          componentCode: comp.componentCode || comp.component_code || null,
          parentId: comp.parentId || comp.parent_id || null,
          category: comp.category || null,
          currentCumulativeRH: comp.currentCumulativeRH || comp.current_cumulative_rh || "0",
          lastUpdated: comp.lastUpdated || comp.last_updated || null,
          vesselId: comp.vesselId || comp.vessel_id || null,
          vesselCode: comp.vesselCode || comp.vessel_code || null,
          dataScope: comp.dataScope || comp.data_scope || "vessel",
          fleetEquipmentCode: comp.fleetEquipmentCode || comp.fleet_equipment_code || null,
          fleetEquipmentName: comp.fleetEquipmentName || comp.fleet_equipment_name || null,
          parentFleetEquipmentCode: comp.parentFleetEquipmentCode || comp.parent_fleet_equipment_code || null,
          maker: comp.maker || null,
          makerCode: comp.makerCode || comp.maker_code || null,
          model: comp.model || null,
          modelNumber: comp.modelNumber || comp.model_number || null,
          modelCode: comp.modelCode || comp.model_code || null,
          serialNo: comp.serialNo || comp.serial_no || null,
          drawingNo: comp.drawingNo || comp.drawing_no || null,
          department: comp.department || null,
          deptCategory: comp.deptCategory || comp.dept_category || null,
          componentCategory: comp.componentCategory || comp.component_category || null,
          location: comp.location || null,
          eqptSystemDept: comp.eqptSystemDept || comp.eqpt_system_dept || null,
          commissionedDate: comp.commissionedDate || comp.commissioned_date || null,
          installationDate: comp.installationDate || comp.installation_date || null,
          critical: comp.critical === true,
          classItem: comp.classItem === true || comp.class_item === true,
          conditionBased: comp.conditionBased === true || comp.condition_based === true,
          isActive: comp.isActive !== false,
          isParent: comp.isParent === true || comp.is_parent === true,
          rating: comp.rating || null,
          noOfUnits: comp.noOfUnits || comp.no_of_units || null,
          parentComponent: comp.parentComponent || comp.parent_component || null,
          dimensionsSize: comp.dimensionsSize || comp.dimensions_size || null,
          notes: comp.notes || null,
          runningHours: comp.runningHours || comp.running_hours || null,
          applicableVesselIds: comp.applicableVesselIds || comp.applicable_vessel_ids || null,
          scopeNotes: comp.scopeNotes || comp.scope_notes || null,
          createdAt: comp.createdAt ? new Date(comp.createdAt) : new Date(),
          updatedAt: comp.updatedAt ? new Date(comp.updatedAt) : new Date(),
        });
      }
    }
    const componentsAfter = await getCount(tx, components);
    results.push({
      table: 'components',
      fileCount: componentsList.length,
      beforeCount: componentsBefore,
      afterCount: componentsAfter,
      migratedCount: componentsAfter - componentsBefore,
      skippedCount: componentsList.length - (componentsAfter - componentsBefore),
    });
    console.log(`[components] Done: ${componentsAfter - componentsBefore} migrated, ${componentsList.length - (componentsAfter - componentsBefore)} skipped`);

    // 2. Migrate Component Documents
    const componentDocsData = fileData.componentDocuments || {};
    const componentDocsList = Object.values(componentDocsData) as any[];
    console.log(`\n[component_documents] Processing ${componentDocsList.length} records (${componentDocsBefore} existing)...`);

    for (const doc of componentDocsList) {
      // For auto-increment ID, check by unique combination
      const existing = await tx.select().from(componentDocuments)
        .where(eq(componentDocuments.fileKey, doc.fileKey || doc.file_key));
      if (existing.length === 0) {
        await tx.insert(componentDocuments).values({
          componentId: doc.componentId || doc.component_id,
          componentCode: doc.componentCode || doc.component_code,
          vesselCode: doc.vesselCode || doc.vessel_code,
          fleetEquipmentCode: doc.fleetEquipmentCode || doc.fleet_equipment_code || null,
          fileName: doc.fileName || doc.file_name,
          fileKey: doc.fileKey || doc.file_key,
          fileType: doc.fileType || doc.file_type,
          fileSize: doc.fileSize ?? doc.file_size ?? null,
          version: doc.version || "1.0",
          uploadedBy: doc.uploadedBy || doc.uploaded_by,
          canShipView: doc.canShipView !== false && doc.can_ship_view !== false,
          canShipDownload: doc.canShipDownload === true || doc.can_ship_download === true,
          isActive: doc.isActive !== false,
          notes: doc.notes || null,
          storageBackend: doc.storageBackend || doc.storage_backend || "object",
        });
      }
    }
    const componentDocsAfter = await getCount(tx, componentDocuments);
    results.push({
      table: 'component_documents',
      fileCount: componentDocsList.length,
      beforeCount: componentDocsBefore,
      afterCount: componentDocsAfter,
      migratedCount: componentDocsAfter - componentDocsBefore,
      skippedCount: componentDocsList.length - (componentDocsAfter - componentDocsBefore),
    });
    console.log(`[component_documents] Done: ${componentDocsAfter - componentDocsBefore} migrated, ${componentDocsList.length - (componentDocsAfter - componentDocsBefore)} skipped`);

    // 3. Migrate Component Class Regulatory
    const componentClassRegData = fileData.componentClassRegulatory || {};
    const componentClassRegList = Object.values(componentClassRegData) as any[];
    console.log(`\n[component_class_regulatory] Processing ${componentClassRegList.length} records (${componentClassRegBefore} existing)...`);

    for (const reg of componentClassRegList) {
      // Check by unique combination of component + survey type + certificate number
      const certNo = reg.certificateNumber || reg.certificate_number || '';
      const compId = reg.componentId || reg.component_id;
      const surveyType = reg.surveyType || reg.survey_type;
      
      const existing = await tx.select().from(componentClassRegulatory)
        .where(eq(componentClassRegulatory.componentId, compId));
      const alreadyExists = existing.some((e: any) => 
        e.surveyType === surveyType && (e.certificateNumber || '') === certNo
      );
      
      if (!alreadyExists) {
        await tx.insert(componentClassRegulatory).values({
          componentId: compId,
          componentCode: reg.componentCode || reg.component_code,
          vesselCode: reg.vesselCode || reg.vessel_code,
          classificationSociety: reg.classificationSociety || reg.classification_society,
          surveyType: surveyType,
          certificateNumber: certNo || null,
          issueDate: reg.issueDate || reg.issue_date || null,
          expiryDate: reg.expiryDate || reg.expiry_date || null,
          lastClassSurvey: reg.lastClassSurvey || reg.last_class_survey || null,
          nextSurveyDue: reg.nextSurveyDue || reg.next_survey_due || null,
          classRequirements: reg.classRequirements || reg.class_requirements || null,
          surveyStatus: reg.surveyStatus || reg.survey_status || "Active",
          remarks: reg.remarks || null,
          createdBy: reg.createdBy || reg.created_by || "system",
          updatedBy: reg.updatedBy || reg.updated_by || null,
        });
      }
    }
    const componentClassRegAfter = await getCount(tx, componentClassRegulatory);
    results.push({
      table: 'component_class_regulatory',
      fileCount: componentClassRegList.length,
      beforeCount: componentClassRegBefore,
      afterCount: componentClassRegAfter,
      migratedCount: componentClassRegAfter - componentClassRegBefore,
      skippedCount: componentClassRegList.length - (componentClassRegAfter - componentClassRegBefore),
    });
    console.log(`[component_class_regulatory] Done: ${componentClassRegAfter - componentClassRegBefore} migrated, ${componentClassRegList.length - (componentClassRegAfter - componentClassRegBefore)} skipped`);

    // 4. Migrate Component Maintenance History (IMMUTABLE - insert only)
    const componentMaintHistData = fileData.componentMaintenanceHistory || {};
    const componentMaintHistList = Object.values(componentMaintHistData) as any[];
    console.log(`\n[component_maintenance_history] Processing ${componentMaintHistList.length} records (${componentMaintHistBefore} existing)...`);

    for (const hist of componentMaintHistList) {
      // Check by work order ID to avoid duplicates
      const woId = hist.workOrderId || hist.work_order_id;
      const existing = await tx.select().from(componentMaintenanceHistory)
        .where(eq(componentMaintenanceHistory.workOrderId, woId));
      
      if (existing.length === 0) {
        await tx.insert(componentMaintenanceHistory).values({
          componentId: hist.componentId || hist.component_id,
          componentCode: hist.componentCode || hist.component_code,
          vesselCode: hist.vesselCode || hist.vessel_code,
          workOrderId: woId,
          workOrderNo: hist.workOrderNo || hist.work_order_no,
          jobTitle: hist.jobTitle || hist.job_title,
          maintenanceType: hist.maintenanceType || hist.maintenance_type,
          dateCompleted: hist.dateCompleted || hist.date_completed,
          runningHoursAtCompletion: hist.runningHoursAtCompletion || hist.running_hours_at_completion || null,
          performedBy: hist.performedBy || hist.performed_by,
          approvedBy: hist.approvedBy || hist.approved_by || null,
          approvalDate: hist.approvalDate || hist.approval_date || null,
          status: hist.status || "Approved",
          workDescription: hist.workDescription || hist.work_description || null,
          sparesUsed: hist.sparesUsed || hist.spares_used || null,
          remarks: hist.remarks || null,
          isComponentReplaced: hist.isComponentReplaced === true || hist.is_component_replaced === true,
        });
      }
    }
    const componentMaintHistAfter = await getCount(tx, componentMaintenanceHistory);
    results.push({
      table: 'component_maintenance_history',
      fileCount: componentMaintHistList.length,
      beforeCount: componentMaintHistBefore,
      afterCount: componentMaintHistAfter,
      migratedCount: componentMaintHistAfter - componentMaintHistBefore,
      skippedCount: componentMaintHistList.length - (componentMaintHistAfter - componentMaintHistBefore),
    });
    console.log(`[component_maintenance_history] Done: ${componentMaintHistAfter - componentMaintHistBefore} migrated, ${componentMaintHistList.length - (componentMaintHistAfter - componentMaintHistBefore)} skipped`);

    // 5. Migrate Component Requisitions
    const componentReqsData = fileData.componentRequisitions || {};
    const componentReqsList = Object.values(componentReqsData) as any[];
    console.log(`\n[component_requisitions] Processing ${componentReqsList.length} records (${componentReqsBefore} existing)...`);

    for (const req of componentReqsList) {
      const reqNo = req.requisitionNo || req.requisition_no;
      const existing = await tx.select().from(componentRequisitions)
        .where(eq(componentRequisitions.requisitionNo, reqNo));
      
      if (existing.length === 0) {
        await tx.insert(componentRequisitions).values({
          requisitionNo: reqNo,
          componentId: req.componentId || req.component_id,
          componentCode: req.componentCode || req.component_code,
          vesselCode: req.vesselCode || req.vessel_code,
          raisedOn: req.raisedOn || req.raised_on,
          itemOrService: req.itemOrService || req.item_or_service,
          relatedPartCode: req.relatedPartCode || req.related_part_code || null,
          relatedPartName: req.relatedPartName || req.related_part_name || null,
          quantity: req.quantity ?? 1,
          uom: req.uom || "EA",
          status: req.status || "Draft",
          priority: req.priority || "Normal",
          requestedBy: req.requestedBy || req.requested_by,
          approvedBy: req.approvedBy || req.approved_by || null,
          approvalDate: req.approvalDate || req.approval_date || null,
          purchaseOrderNo: req.purchaseOrderNo || req.purchase_order_no || null,
          expectedDelivery: req.expectedDelivery || req.expected_delivery || null,
          actualDelivery: req.actualDelivery || req.actual_delivery || null,
          supplier: req.supplier || null,
          estimatedCost: req.estimatedCost || req.estimated_cost || null,
          actualCost: req.actualCost || req.actual_cost || null,
          remarks: req.remarks || null,
        });
      }
    }
    const componentReqsAfter = await getCount(tx, componentRequisitions);
    results.push({
      table: 'component_requisitions',
      fileCount: componentReqsList.length,
      beforeCount: componentReqsBefore,
      afterCount: componentReqsAfter,
      migratedCount: componentReqsAfter - componentReqsBefore,
      skippedCount: componentReqsList.length - (componentReqsAfter - componentReqsBefore),
    });
    console.log(`[component_requisitions] Done: ${componentReqsAfter - componentReqsBefore} migrated, ${componentReqsList.length - (componentReqsAfter - componentReqsBefore)} skipped`);

    // 6. Migrate Running Hours Audit
    // Note: test-data.json uses "runningHoursAudits" (with 's')
    const rhAuditData = fileData.runningHoursAudits || {};
    const rhAuditList = Object.values(rhAuditData) as any[];
    console.log(`\n[running_hours_audit] Processing ${rhAuditList.length} records (${rhAuditBefore} existing)...`);

    for (const audit of rhAuditList) {
      // Check by unique combination of component + timestamp
      const compId = audit.componentId || audit.component_id;
      const enteredAt = audit.enteredAtUTC || audit.entered_at_utc;
      
      // For auto-increment tables, we need a different approach
      // Check if similar record exists
      const existing = await tx.select().from(runningHoursAudit)
        .where(eq(runningHoursAudit.componentId, compId));
      const alreadyExists = existing.some((e: any) => {
        const existingTime = new Date(e.enteredAtUTC).getTime();
        const newTime = new Date(enteredAt).getTime();
        return Math.abs(existingTime - newTime) < 1000; // Within 1 second
      });
      
      if (!alreadyExists) {
        await tx.insert(runningHoursAudit).values({
          vesselId: audit.vesselId || audit.vessel_id,
          componentId: compId,
          previousRH: audit.previousRH || audit.previous_rh || "0",
          newRH: audit.newRH || audit.new_rh || "0",
          cumulativeRH: audit.cumulativeRH || audit.cumulative_rh || "0",
          dateUpdatedLocal: audit.dateUpdatedLocal || audit.date_updated_local,
          dateUpdatedTZ: audit.dateUpdatedTZ || audit.date_updated_tz || "UTC",
          enteredAtUTC: new Date(enteredAt),
          userId: audit.userId || audit.user_id,
          source: audit.source || "single",
          notes: audit.notes || null,
          meterReplaced: audit.meterReplaced === true || audit.meter_replaced === true,
          oldMeterFinal: audit.oldMeterFinal || audit.old_meter_final || null,
          newMeterStart: audit.newMeterStart || audit.new_meter_start || null,
          version: audit.version ?? 1,
        });
      }
    }
    const rhAuditAfter = await getCount(tx, runningHoursAudit);
    results.push({
      table: 'running_hours_audit',
      fileCount: rhAuditList.length,
      beforeCount: rhAuditBefore,
      afterCount: rhAuditAfter,
      migratedCount: rhAuditAfter - rhAuditBefore,
      skippedCount: rhAuditList.length - (rhAuditAfter - rhAuditBefore),
    });
    console.log(`[running_hours_audit] Done: ${rhAuditAfter - rhAuditBefore} migrated, ${rhAuditList.length - (rhAuditAfter - rhAuditBefore)} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 3: Components Data Migration');
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

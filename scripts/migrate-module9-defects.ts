#!/usr/bin/env npx tsx
/**
 * Module 9: Defects Data Migration Script
 * Migrates defects, defect_actions, defect_attachments, recurring_defects, recurring_defect_links from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module9-defects.ts
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
import { eq, sql, and } from 'drizzle-orm';
import { getDb } from '../server/db';
import { defects, defectActions, defectAttachments, recurringDefects, recurringDefectLinks } from '../shared/schema';

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

    // =========== DEFECTS ===========
    const defectsBefore = await getCount(tx, defects);
    const defectsData = fileData.defects || {};
    const defectsList = Object.values(defectsData) as any[];

    console.log(`[defects] Processing ${defectsList.length} records (${defectsBefore} existing)...`);

    let defectsMigrated = 0;
    let defectsSkipped = 0;

    for (const defect of defectsList) {
      const existing = await tx.select().from(defects).where(eq(defects.id, defect.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(defects).values({
            id: defect.id,
            seedId: defect.seedId || null,
            vesselId: defect.vesselId || defect.vessel_id || '',
            title: defect.title || defect.defect || 'Untitled Defect',
            description: defect.description || null,
            status: defect.status || 'Open',
            priority: defect.priority || 'Medium',
            category: defect.category || null,
            is_coc: defect.is_coc || defect.isCoC || defect.isCoc || false,
            cocStatus: defect.cocStatus || null,
            viqCode: defect.viqCode || defect.viq_code || null,
            issueDate: defect.issueDate || defect.issue_date || new Date().toISOString().split('T')[0],
            targetDate: defect.targetDate || defect.target_date || null,
            extendedDate: defect.extendedDate || defect.extended_date || null,
            dateCompleted: defect.dateCompleted || defect.date_completed || null,
            reportedBy: defect.reportedBy || defect.reported_by || null,
            assignedTo: defect.assignedTo || defect.assigned_to || null,
            componentId: defect.componentId || defect.component_id || null,
            componentCode: defect.componentCode || defect.component_code || null,
            componentName: defect.componentName || defect.component_name || null,
            location: defect.location || null,
            equipment: defect.equipment || null,
            equipmentKey: defect.equipmentKey || defect.equipment_key || null,
            rootCause: defect.rootCause || defect.root_cause || null,
            correctiveAction: defect.correctiveAction || defect.corrective_action || null,
            preventiveAction: defect.preventiveAction || defect.preventive_action || null,
            notes: defect.notes || [],
            linkedDefects: defect.linkedDefects || defect.linked_defects || [],
            closedBy: defect.closedBy || defect.closed_by || null,
            closedOn: defect.closedOn || defect.closed_on || null,
            closureComment: defect.closureComment || defect.closure_comment || null,
            closureFiles: defect.closureFiles || defect.closure_files || [],
            source: defect.source || 'manual',
            createdAt: defect.createdAt ? new Date(defect.createdAt) : new Date(),
            updatedAt: defect.updatedAt ? new Date(defect.updatedAt) : new Date(),
          });
          defectsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Defect with id ${defect.id} already exists (unique constraint)`);
            defectsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        defectsSkipped++;
      }
    }

    const defectsAfter = await getCount(tx, defects);
    results.push({
      table: 'defects',
      fileCount: defectsList.length,
      beforeCount: defectsBefore,
      afterCount: defectsAfter,
      migratedCount: defectsMigrated,
      skippedCount: defectsSkipped,
    });
    console.log(`[defects] Done: ${defectsMigrated} migrated, ${defectsSkipped} skipped`);

    // =========== DEFECT ACTIONS ===========
    const defectActionsBefore = await getCount(tx, defectActions);
    const defectActionsData = fileData.defectActions || {};
    const defectActionsList = Object.values(defectActionsData) as any[];

    console.log(`[defect_actions] Processing ${defectActionsList.length} records (${defectActionsBefore} existing)...`);

    let defectActionsMigrated = 0;
    let defectActionsSkipped = 0;

    for (const action of defectActionsList) {
      const actionId = typeof action.id === 'number' ? action.id : parseInt(action.id, 10);
      if (isNaN(actionId)) continue;
      
      const existing = await tx.select().from(defectActions).where(eq(defectActions.id, actionId));
      
      if (existing.length === 0) {
        try {
          await tx.insert(defectActions).values({
            id: actionId,
            defectId: action.defectId || action.defect_id,
            actionType: action.actionType || action.action_type || 'general',
            description: action.description || '',
            status: action.status || 'pending',
            assignedTo: action.assignedTo || action.assigned_to || null,
            dueDate: action.dueDate || action.due_date || null,
            completedDate: action.completedDate || action.completed_date || null,
            completedBy: action.completedBy || action.completed_by || null,
            notes: action.notes || null,
            createdAt: action.createdAt ? new Date(action.createdAt) : new Date(),
            updatedAt: action.updatedAt ? new Date(action.updatedAt) : new Date(),
          });
          defectActionsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Defect action with id ${actionId} already exists (unique constraint)`);
            defectActionsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        defectActionsSkipped++;
      }
    }

    const defectActionsAfter = await getCount(tx, defectActions);
    results.push({
      table: 'defect_actions',
      fileCount: defectActionsList.length,
      beforeCount: defectActionsBefore,
      afterCount: defectActionsAfter,
      migratedCount: defectActionsMigrated,
      skippedCount: defectActionsSkipped,
    });
    console.log(`[defect_actions] Done: ${defectActionsMigrated} migrated, ${defectActionsSkipped} skipped`);

    // =========== DEFECT ATTACHMENTS ===========
    const defectAttachmentsBefore = await getCount(tx, defectAttachments);
    const defectAttachmentsData = fileData.defectAttachments || {};
    const defectAttachmentsList = Object.values(defectAttachmentsData) as any[];

    console.log(`[defect_attachments] Processing ${defectAttachmentsList.length} records (${defectAttachmentsBefore} existing)...`);

    let defectAttachmentsMigrated = 0;
    let defectAttachmentsSkipped = 0;

    for (const attachment of defectAttachmentsList) {
      const attachmentId = typeof attachment.id === 'number' ? attachment.id : parseInt(attachment.id, 10);
      if (isNaN(attachmentId)) continue;
      
      const existing = await tx.select().from(defectAttachments).where(eq(defectAttachments.id, attachmentId));
      
      if (existing.length === 0) {
        try {
          await tx.insert(defectAttachments).values({
            id: attachmentId,
            defectId: attachment.defectId || attachment.defect_id,
            fileName: attachment.fileName || attachment.file_name || 'unknown',
            fileType: attachment.fileType || attachment.file_type || 'application/octet-stream',
            fileSize: attachment.fileSize || attachment.file_size || 0,
            filePath: attachment.filePath || attachment.file_path || null,
            fileData: attachment.fileData || attachment.file_data || null,
            uploadedBy: attachment.uploadedBy || attachment.uploaded_by || 'system',
            createdAt: attachment.createdAt ? new Date(attachment.createdAt) : new Date(),
          });
          defectAttachmentsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Defect attachment with id ${attachmentId} already exists (unique constraint)`);
            defectAttachmentsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        defectAttachmentsSkipped++;
      }
    }

    const defectAttachmentsAfter = await getCount(tx, defectAttachments);
    results.push({
      table: 'defect_attachments',
      fileCount: defectAttachmentsList.length,
      beforeCount: defectAttachmentsBefore,
      afterCount: defectAttachmentsAfter,
      migratedCount: defectAttachmentsMigrated,
      skippedCount: defectAttachmentsSkipped,
    });
    console.log(`[defect_attachments] Done: ${defectAttachmentsMigrated} migrated, ${defectAttachmentsSkipped} skipped`);

    // =========== RECURRING DEFECTS ===========
    const recurringDefectsBefore = await getCount(tx, recurringDefects);
    const recurringDefectsData = fileData.recurringDefects || {};
    const recurringDefectsList = Object.values(recurringDefectsData) as any[];

    console.log(`[recurring_defects] Processing ${recurringDefectsList.length} records (${recurringDefectsBefore} existing)...`);

    let recurringDefectsMigrated = 0;
    let recurringDefectsSkipped = 0;

    for (const recurring of recurringDefectsList) {
      const recurringId = typeof recurring.id === 'number' ? recurring.id : parseInt(recurring.id, 10);
      if (isNaN(recurringId)) continue;
      
      const existing = await tx.select().from(recurringDefects).where(eq(recurringDefects.id, recurringId));
      
      if (existing.length === 0) {
        try {
          await tx.insert(recurringDefects).values({
            id: recurringId,
            equipmentKey: recurring.equipmentKey || recurring.equipment_key || '',
            windowMonths: recurring.windowMonths || recurring.window_months || 12,
            occurrenceCount: recurring.occurrenceCount || recurring.occurrence_count || 1,
            latestDefectId: recurring.latestDefectId || recurring.latest_defect_id || null,
            hasCoc: recurring.hasCoc || recurring.has_coc || false,
            componentCode: recurring.componentCode || recurring.component_code || null,
            componentName: recurring.componentName || recurring.component_name || null,
            vesselId: recurring.vesselId || recurring.vessel_id || null,
            createdAt: recurring.createdAt ? new Date(recurring.createdAt) : new Date(),
            updatedAt: recurring.updatedAt ? new Date(recurring.updatedAt) : new Date(),
          });
          recurringDefectsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Recurring defect with id ${recurringId} already exists (unique constraint)`);
            recurringDefectsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        recurringDefectsSkipped++;
      }
    }

    const recurringDefectsAfter = await getCount(tx, recurringDefects);
    results.push({
      table: 'recurring_defects',
      fileCount: recurringDefectsList.length,
      beforeCount: recurringDefectsBefore,
      afterCount: recurringDefectsAfter,
      migratedCount: recurringDefectsMigrated,
      skippedCount: recurringDefectsSkipped,
    });
    console.log(`[recurring_defects] Done: ${recurringDefectsMigrated} migrated, ${recurringDefectsSkipped} skipped`);

    // =========== RECURRING DEFECT LINKS ===========
    const recurringDefectLinksBefore = await getCount(tx, recurringDefectLinks);
    const recurringDefectLinksData = fileData.recurringDefectLinks || [];
    const recurringDefectLinksList = Array.isArray(recurringDefectLinksData) 
      ? recurringDefectLinksData 
      : Object.values(recurringDefectLinksData);

    console.log(`[recurring_defect_links] Processing ${recurringDefectLinksList.length} records (${recurringDefectLinksBefore} existing)...`);

    let recurringDefectLinksMigrated = 0;
    let recurringDefectLinksSkipped = 0;

    for (const link of recurringDefectLinksList as any[]) {
      const recurringId = link.recurringId || link.recurring_id;
      const defectId = link.defectId || link.defect_id;
      
      if (!recurringId || !defectId) continue;
      
      // Check by composite key (recurringId + defectId)
      const existing = await tx.select().from(recurringDefectLinks)
        .where(and(
          eq(recurringDefectLinks.recurringId, recurringId),
          eq(recurringDefectLinks.defectId, defectId)
        ));
      
      if (existing.length === 0) {
        try {
          await tx.insert(recurringDefectLinks).values({
            recurringId: recurringId,
            defectId: defectId,
          });
          recurringDefectLinksMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Recurring defect link (${recurringId}, ${defectId}) already exists (unique constraint)`);
            recurringDefectLinksSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        recurringDefectLinksSkipped++;
      }
    }

    const recurringDefectLinksAfter = await getCount(tx, recurringDefectLinks);
    results.push({
      table: 'recurring_defect_links',
      fileCount: recurringDefectLinksList.length,
      beforeCount: recurringDefectLinksBefore,
      afterCount: recurringDefectLinksAfter,
      migratedCount: recurringDefectLinksMigrated,
      skippedCount: recurringDefectLinksSkipped,
    });
    console.log(`[recurring_defect_links] Done: ${recurringDefectLinksMigrated} migrated, ${recurringDefectLinksSkipped} skipped`);

    console.log('\n[TRANSACTION] All inserts successful, committing...');
  });

  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Module 9: Defects Data Migration');
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

#!/usr/bin/env npx tsx
/**
 * Module 12: Change Requests Data Migration Script
 * Migrates change_request, change_request_attachment, change_request_comment from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module12-change-requests.ts
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
import { changeRequest, changeRequestAttachment, changeRequestComment } from '../shared/schema';

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

    // =========== CHANGE REQUESTS ===========
    const requestsBefore = await getCount(tx, changeRequest);
    const requestsData = fileData.changeRequests || {};
    const requestsList = Array.isArray(requestsData) ? requestsData : Object.values(requestsData) as any[];

    console.log(`[change_request] Processing ${requestsList.length} records (${requestsBefore} existing)...`);

    let requestsMigrated = 0;
    let requestsSkipped = 0;

    for (const request of requestsList) {
      const existing = await tx.select().from(changeRequest).where(eq(changeRequest.id, request.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(changeRequest).values({
            id: request.id,
            vesselId: request.vesselId || request.vessel_id,
            category: request.category,
            targetType: request.targetType || request.target_type || null,
            targetId: request.targetId || request.target_id || null,
            snapshotBeforeJson: request.snapshotBeforeJson || request.snapshot_before_json || null,
            proposedChangesJson: request.proposedChangesJson || request.proposed_changes_json || null,
            movePreviewJson: request.movePreviewJson || request.move_preview_json || null,
            title: request.title,
            status: request.status || 'draft',
            requestedByUserId: request.requestedByUserId || request.requested_by_user_id,
            submittedAt: request.submittedAt ? new Date(request.submittedAt) : (request.submitted_at ? new Date(request.submitted_at) : null),
            reviewedByUserId: request.reviewedByUserId || request.reviewed_by_user_id || null,
            reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : (request.reviewed_at ? new Date(request.reviewed_at) : null),
            revisionNumber: request.revisionNumber || request.revision_number || 0,
            revisionHistory: request.revisionHistory || request.revision_history || [],
          });
          requestsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Change request with id ${request.id} already exists (unique constraint)`);
            requestsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        requestsSkipped++;
      }
    }

    const requestsAfter = await getCount(tx, changeRequest);
    results.push({
      table: 'change_request',
      fileCount: requestsList.length,
      beforeCount: requestsBefore,
      afterCount: requestsAfter,
      migratedCount: requestsMigrated,
      skippedCount: requestsSkipped,
    });

    // =========== CHANGE REQUEST ATTACHMENTS ===========
    const attachmentsBefore = await getCount(tx, changeRequestAttachment);
    const attachmentsData = fileData.changeRequestAttachments || {};
    const attachmentsList = Array.isArray(attachmentsData) ? attachmentsData : Object.values(attachmentsData) as any[];

    console.log(`[change_request_attachment] Processing ${attachmentsList.length} records (${attachmentsBefore} existing)...`);

    let attachmentsMigrated = 0;
    let attachmentsSkipped = 0;

    for (const attachment of attachmentsList) {
      const existing = attachment.id 
        ? await tx.select().from(changeRequestAttachment).where(eq(changeRequestAttachment.id, attachment.id))
        : [];
      
      if (existing.length === 0) {
        try {
          const insertData: any = {
            changeRequestId: attachment.changeRequestId || attachment.change_request_id,
            fileName: attachment.fileName || attachment.file_name,
            fileType: attachment.fileType || attachment.file_type,
            fileSizeBytes: attachment.fileSizeBytes || attachment.file_size_bytes || 0,
            storageKey: attachment.storageKey || attachment.storage_key,
            uploadedByUserId: attachment.uploadedByUserId || attachment.uploaded_by_user_id,
          };
          
          if (attachment.id) {
            insertData.id = attachment.id;
          }
          
          await tx.insert(changeRequestAttachment).values(insertData);
          attachmentsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Change request attachment already exists (unique constraint)`);
            attachmentsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        attachmentsSkipped++;
      }
    }

    const attachmentsAfter = await getCount(tx, changeRequestAttachment);
    results.push({
      table: 'change_request_attachment',
      fileCount: attachmentsList.length,
      beforeCount: attachmentsBefore,
      afterCount: attachmentsAfter,
      migratedCount: attachmentsMigrated,
      skippedCount: attachmentsSkipped,
    });

    // =========== CHANGE REQUEST COMMENTS ===========
    const commentsBefore = await getCount(tx, changeRequestComment);
    const commentsData = fileData.changeRequestComments || {};
    const commentsList = Array.isArray(commentsData) ? commentsData : Object.values(commentsData) as any[];

    console.log(`[change_request_comment] Processing ${commentsList.length} records (${commentsBefore} existing)...`);

    let commentsMigrated = 0;
    let commentsSkipped = 0;

    for (const comment of commentsList) {
      const existing = comment.id 
        ? await tx.select().from(changeRequestComment).where(eq(changeRequestComment.id, comment.id))
        : [];
      
      if (existing.length === 0) {
        try {
          const insertData: any = {
            changeRequestId: comment.changeRequestId || comment.change_request_id,
            userId: comment.userId || comment.user_id,
            comment: comment.comment,
          };
          
          if (comment.id) {
            insertData.id = comment.id;
          }
          
          await tx.insert(changeRequestComment).values(insertData);
          commentsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Change request comment already exists (unique constraint)`);
            commentsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        commentsSkipped++;
      }
    }

    const commentsAfter = await getCount(tx, changeRequestComment);
    results.push({
      table: 'change_request_comment',
      fileCount: commentsList.length,
      beforeCount: commentsBefore,
      afterCount: commentsAfter,
      migratedCount: commentsMigrated,
      skippedCount: commentsSkipped,
    });

    console.log('\n[TRANSACTION] All operations completed successfully. Committing...\n');
  });

  return results;
}

async function main() {
  console.log('='.repeat(70));
  console.log('MODULE 12: CHANGE REQUESTS DATA MIGRATION');
  console.log('='.repeat(70));
  console.log('\nMigrating: change_request, change_request_attachment, change_request_comment');
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
    console.log('\n✅ Module 12 (Change Requests) migration completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n[ROLLBACK] All changes have been rolled back due to error.\n');
    process.exit(1);
  }
}

main();

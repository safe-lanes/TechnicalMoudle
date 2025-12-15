#!/usr/bin/env npx tsx
/**
 * Module 10: Alerts Data Migration Script
 * Migrates alert_policies, alert_events, alert_deliveries, alert_config from JSON to PostgreSQL
 * 
 * Usage: npx tsx scripts/migrate-module10-alerts.ts
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
import { alertPolicies, alertEvents, alertDeliveries, alertConfig } from '../shared/schema';

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

    // =========== ALERT POLICIES ===========
    const policiesBefore = await getCount(tx, alertPolicies);
    const policiesData = fileData.alertPolicies || {};
    const policiesList = Object.values(policiesData) as any[];

    console.log(`[alert_policies] Processing ${policiesList.length} records (${policiesBefore} existing)...`);

    let policiesMigrated = 0;
    let policiesSkipped = 0;

    for (const policy of policiesList) {
      const existing = await tx.select().from(alertPolicies).where(eq(alertPolicies.id, policy.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(alertPolicies).values({
            id: policy.id,
            alertType: policy.alertType || policy.alert_type || 'maintenance_due',
            enabled: policy.enabled ?? true,
            priority: policy.priority || 'medium',
            emailEnabled: policy.emailEnabled ?? policy.email_enabled ?? false,
            inAppEnabled: policy.inAppEnabled ?? policy.in_app_enabled ?? true,
            thresholds: typeof policy.thresholds === 'string' ? policy.thresholds : JSON.stringify(policy.thresholds || {}),
            scopeFilters: typeof policy.scopeFilters === 'string' ? policy.scopeFilters : JSON.stringify(policy.scopeFilters || policy.scope_filters || {}),
            recipients: typeof policy.recipients === 'string' ? policy.recipients : JSON.stringify(policy.recipients || {}),
            createdBy: policy.createdBy || policy.created_by || 'system',
            updatedBy: policy.updatedBy || policy.updated_by || 'system',
            createdAt: policy.createdAt ? new Date(policy.createdAt) : new Date(),
            updatedAt: policy.updatedAt ? new Date(policy.updatedAt) : new Date(),
          });
          policiesMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Alert policy with id ${policy.id} already exists (unique constraint)`);
            policiesSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        policiesSkipped++;
      }
    }

    const policiesAfter = await getCount(tx, alertPolicies);
    results.push({
      table: 'alert_policies',
      fileCount: policiesList.length,
      beforeCount: policiesBefore,
      afterCount: policiesAfter,
      migratedCount: policiesMigrated,
      skippedCount: policiesSkipped,
    });

    // =========== ALERT EVENTS ===========
    const eventsBefore = await getCount(tx, alertEvents);
    const eventsData = fileData.alertEvents || {};
    const eventsList = Object.values(eventsData) as any[];

    console.log(`[alert_events] Processing ${eventsList.length} records (${eventsBefore} existing)...`);

    let eventsMigrated = 0;
    let eventsSkipped = 0;

    for (const event of eventsList) {
      const existing = await tx.select().from(alertEvents).where(eq(alertEvents.id, event.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(alertEvents).values({
            id: event.id,
            policyId: event.policyId || event.policy_id || 0,
            alertType: event.alertType || event.alert_type || 'maintenance_due',
            priority: event.priority || 'medium',
            objectType: event.objectType || event.object_type || null,
            objectId: event.objectId || event.object_id || null,
            vesselId: event.vesselId || event.vessel_id || null,
            dedupeKey: event.dedupeKey || event.dedupe_key || `${event.alertType}-${event.objectId}-${Date.now()}`,
            state: event.state || null,
            payload: typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload || {}),
            ackBy: event.ackBy || event.ack_by || null,
            ackAt: event.ackAt ? new Date(event.ackAt) : (event.ack_at ? new Date(event.ack_at) : null),
            createdAt: event.createdAt ? new Date(event.createdAt) : new Date(),
          });
          eventsMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Alert event with id ${event.id} already exists (unique constraint)`);
            eventsSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        eventsSkipped++;
      }
    }

    const eventsAfter = await getCount(tx, alertEvents);
    results.push({
      table: 'alert_events',
      fileCount: eventsList.length,
      beforeCount: eventsBefore,
      afterCount: eventsAfter,
      migratedCount: eventsMigrated,
      skippedCount: eventsSkipped,
    });

    // =========== ALERT DELIVERIES ===========
    const deliveriesBefore = await getCount(tx, alertDeliveries);
    const deliveriesData = fileData.alertDeliveries || {};
    const deliveriesList = Object.values(deliveriesData) as any[];

    console.log(`[alert_deliveries] Processing ${deliveriesList.length} records (${deliveriesBefore} existing)...`);

    let deliveriesMigrated = 0;
    let deliveriesSkipped = 0;

    for (const delivery of deliveriesList) {
      const existing = await tx.select().from(alertDeliveries).where(eq(alertDeliveries.id, delivery.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(alertDeliveries).values({
            id: delivery.id,
            eventId: delivery.eventId || delivery.event_id || 0,
            channel: delivery.channel || 'in_app',
            recipient: delivery.recipient || '',
            status: delivery.status || 'pending',
            errorMessage: delivery.errorMessage || delivery.error_message || null,
            sentAt: delivery.sentAt ? new Date(delivery.sentAt) : (delivery.sent_at ? new Date(delivery.sent_at) : null),
            acknowledgedAt: delivery.acknowledgedAt ? new Date(delivery.acknowledgedAt) : (delivery.acknowledged_at ? new Date(delivery.acknowledged_at) : null),
            createdAt: delivery.createdAt ? new Date(delivery.createdAt) : new Date(),
          });
          deliveriesMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Alert delivery with id ${delivery.id} already exists (unique constraint)`);
            deliveriesSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        deliveriesSkipped++;
      }
    }

    const deliveriesAfter = await getCount(tx, alertDeliveries);
    results.push({
      table: 'alert_deliveries',
      fileCount: deliveriesList.length,
      beforeCount: deliveriesBefore,
      afterCount: deliveriesAfter,
      migratedCount: deliveriesMigrated,
      skippedCount: deliveriesSkipped,
    });

    // =========== ALERT CONFIG ===========
    const configBefore = await getCount(tx, alertConfig);
    const configData = fileData.alertConfig || {};
    const configList = Object.values(configData) as any[];

    console.log(`[alert_config] Processing ${configList.length} records (${configBefore} existing)...`);

    let configMigrated = 0;
    let configSkipped = 0;

    for (const config of configList) {
      const existing = await tx.select().from(alertConfig).where(eq(alertConfig.id, config.id));
      
      if (existing.length === 0) {
        try {
          await tx.insert(alertConfig).values({
            id: config.id,
            vesselId: config.vesselId || config.vessel_id || '',
            quietHoursEnabled: config.quietHoursEnabled ?? config.quiet_hours_enabled ?? false,
            quietHoursStart: config.quietHoursStart || config.quiet_hours_start || null,
            quietHoursEnd: config.quietHoursEnd || config.quiet_hours_end || null,
            escalationEnabled: config.escalationEnabled ?? config.escalation_enabled ?? false,
            escalationHours: config.escalationHours ?? config.escalation_hours ?? 4,
            escalationRecipients: typeof config.escalationRecipients === 'string' 
              ? config.escalationRecipients 
              : JSON.stringify(config.escalationRecipients || config.escalation_recipients || []),
            updatedBy: config.updatedBy || config.updated_by || 'system',
            createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
            updatedAt: config.updatedAt ? new Date(config.updatedAt) : new Date(),
          });
          configMigrated++;
        } catch (error: any) {
          if (error.message?.includes('unique') || error.code === '23505') {
            console.log(`  [SKIP] Alert config with id ${config.id} already exists (unique constraint)`);
            configSkipped++;
          } else {
            throw error;
          }
        }
      } else {
        configSkipped++;
      }
    }

    const configAfter = await getCount(tx, alertConfig);
    results.push({
      table: 'alert_config',
      fileCount: configList.length,
      beforeCount: configBefore,
      afterCount: configAfter,
      migratedCount: configMigrated,
      skippedCount: configSkipped,
    });

    console.log('\n[TRANSACTION] All migrations successful, committing...');
  });

  return results;
}

async function main() {
  console.log('=========================================');
  console.log('  Module 10: Alerts Migration Script');
  console.log('=========================================\n');

  try {
    const fileData = await loadFileData();
    console.log('✅ Loaded test-data.json');

    const db = await getDb();
    console.log('✅ Connected to PostgreSQL\n');

    const results = await migrateWithTransaction(db, fileData);

    console.log('\n=========================================');
    console.log('           MIGRATION SUMMARY');
    console.log('=========================================\n');

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const result of results) {
      console.log(`📊 ${result.table}:`);
      console.log(`   File records:  ${result.fileCount}`);
      console.log(`   Before:        ${result.beforeCount}`);
      console.log(`   After:         ${result.afterCount}`);
      console.log(`   Migrated:      ${result.migratedCount}`);
      console.log(`   Skipped:       ${result.skippedCount}`);
      console.log('');
      totalMigrated += result.migratedCount;
      totalSkipped += result.skippedCount;
    }

    console.log('=========================================');
    console.log(`✅ TOTAL: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    console.log('=========================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();

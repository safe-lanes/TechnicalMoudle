import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { resolvePostgres } from './postgresClient';
import { POSTPONEMENT_REASONS } from '../shared/postponementReasons';
import { OVERDUE_REASONS } from '../shared/overdueReasons';

/**
 * Ensure immutability trigger exists for component_maintenance_history
 * This function is idempotent and can be called multiple times safely
 * 
 * Behavior:
 * - No DATABASE_URL: Skips trigger creation, returns void
 * - PostgreSQL mode: Creates/verifies triggers, throws on failure
 * 
 * IMPORTANT: This function throws if trigger creation fails in PostgreSQL mode
 * to ensure immutability is enforced before serving traffic.
 */
export async function ensureMaintenanceHistoryImmutability(poolArg?: Pool): Promise<void> {
  console.log('🔒 Ensuring immutability trigger for component_maintenance_history...');

  // Phase-1 Part E: optional per-tenant pool; no-arg path resolves the single client as before.
  const postgres = poolArg ? { db: drizzle(poolArg, { schema }) } : await resolvePostgres();

  if (!postgres) {
    console.log('⚠️  Skipping immutability trigger setup - PostgreSQL connection unavailable');
    return;
  }
  
  const { db } = postgres;
  
  try {
    // Create trigger function to prevent modifications
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION prevent_maintenance_history_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Maintenance history records are immutable - cannot modify or delete existing records';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create BEFORE UPDATE trigger
    await db.execute(sql`
      DROP TRIGGER IF EXISTS prevent_maintenance_history_update ON component_maintenance_history;
    `);
    await db.execute(sql`
      CREATE TRIGGER prevent_maintenance_history_update
        BEFORE UPDATE ON component_maintenance_history
        FOR EACH ROW
        EXECUTE FUNCTION prevent_maintenance_history_modification();
    `);
    
    // Create BEFORE DELETE trigger
    await db.execute(sql`
      DROP TRIGGER IF EXISTS prevent_maintenance_history_delete ON component_maintenance_history;
    `);
    await db.execute(sql`
      CREATE TRIGGER prevent_maintenance_history_delete
        BEFORE DELETE ON component_maintenance_history
        FOR EACH ROW
        EXECUTE FUNCTION prevent_maintenance_history_modification();
    `);
    
    // Verify triggers were created successfully
    const verifyResult = await db.execute(sql`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'component_maintenance_history'
      AND trigger_name IN ('prevent_maintenance_history_update', 'prevent_maintenance_history_delete')
    `);
    
    const triggerCount = (verifyResult.rows as any[]).length;
    if (triggerCount !== 2) {
      throw new Error(
        `Immutability trigger verification failed: Expected 2 triggers, found ${triggerCount}. ` +
        `Triggers 'prevent_maintenance_history_update' and 'prevent_maintenance_history_delete' must exist.`
      );
    }
    
    console.log('✅ Immutability triggers verified: component_maintenance_history is now immutable (INSERT-only)');
  } catch (error: any) {
    // Throw with context - startup must fail if trigger creation fails
    throw new Error(
      `Failed to ensure maintenance history immutability: ${error.message}. ` +
      `Possible causes: Missing component_maintenance_history table, insufficient database permissions, ` +
      `or trigger creation error. Server cannot start without immutability enforcement.`
    );
  }
}

/**
 * Ensure the partial unique index uniq_vessel_certificate_applicability_live
 * exists on vessel_certificate_applicability(vessel_id, master_id) WHERE
 * is_deleted = false.
 *
 * Why this lives at startup as well as in migration 095:
 * Every insertApplicability/insertApplicabilityBulk call uses ON CONFLICT
 * (vessel_id, master_id) WHERE is_deleted = false. Without that exact partial
 * index Postgres raises 42P10 ("there is no unique or exclusion constraint
 * matching the ON CONFLICT specification") and the entire request 500s. On the
 * deployed ship database this exact failure broke Admin → Ship Certificates
 * (Master/Company Save toasted an error while persisting orphan rows; Vessel
 * Save and per-row checkbox toggles 500ed outright). This invariant guarantees
 * the index is present even when migration 095 was skipped or rolled back.
 */
export async function ensureCertApplicabilityIndex(): Promise<void> {
  console.log('🔒 Ensuring partial unique index for vessel_certificate_applicability...');

  const postgres = await resolvePostgres();
  if (!postgres) {
    console.log('⚠️  Skipping cert applicability index check - PostgreSQL connection unavailable');
    return;
  }

  const { db } = postgres;

  try {
    const tableCheck = await db.execute(sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'vessel_certificate_applicability'
      LIMIT 1
    `);
    if ((tableCheck.rows as any[]).length === 0) {
      console.log('⚠️  vessel_certificate_applicability table does not exist yet — skipping index check');
      return;
    }

    const before = await db.execute(sql`
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'uniq_vessel_certificate_applicability_live'
      LIMIT 1
    `);
    const existedBefore = (before.rows as any[]).length > 0;

    if (!existedBefore) {
      console.warn(
        '⚠️  Missing uniq_vessel_certificate_applicability_live — attempting to create. ' +
        'This means migration 095 did not apply cleanly on this database.'
      );
    }

    // Attempt CREATE UNIQUE INDEX IF NOT EXISTS. If duplicate live rows
    // exist (Postgres error 23505 during index build) we deliberately do NOT
    // auto-delete them — silent dedupe risks data loss. Instead, surface the
    // offending (vessel_id, master_id) pairs for an operator to reconcile.
    try {
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_vessel_certificate_applicability_live
          ON vessel_certificate_applicability (vessel_id, master_id)
          WHERE is_deleted = false
      `);
    } catch (createErr: any) {
      // 23505 / 42P07-style failures usually mean duplicate live rows.
      const dupes = await db.execute(sql`
        SELECT vessel_id, master_id, COUNT(*)::int AS live_count,
               ARRAY_AGG(id ORDER BY updated_at DESC NULLS LAST, id DESC) AS row_ids
        FROM vessel_certificate_applicability
        WHERE is_deleted = false
        GROUP BY vessel_id, master_id
        HAVING COUNT(*) > 1
        ORDER BY live_count DESC
        LIMIT 25
      `);
      const dupRows = dupes.rows as any[];
      if (dupRows.length > 0) {
        const summary = dupRows
          .map(r => `(vessel_id=${r.vessel_id}, master_id=${r.master_id}, live_count=${r.live_count}, ids=[${r.row_ids}])`)
          .join('\n  ');
        throw new Error(
          `Cannot create uniq_vessel_certificate_applicability_live: ${dupRows.length}+ duplicate live (vessel_id, master_id) groups exist. ` +
          `Operator must reconcile these manually (soft-delete the obsolete row in each group) before the server can start. ` +
          `Top duplicate groups (limit 25):\n  ${summary}\n` +
          `Original CREATE INDEX error: ${createErr.message}`
        );
      }
      // Not a duplicate-row failure — re-raise.
      throw createErr;
    }

    const verify = await db.execute(sql`
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'uniq_vessel_certificate_applicability_live'
      LIMIT 1
    `);
    if ((verify.rows as any[]).length === 0) {
      throw new Error(
        'uniq_vessel_certificate_applicability_live still missing after CREATE INDEX IF NOT EXISTS — ' +
        'cert admin writes will continue to fail with 42P10.'
      );
    }

    if (existedBefore) {
      console.log('✅ uniq_vessel_certificate_applicability_live verified');
    } else {
      console.log('✅ uniq_vessel_certificate_applicability_live created and verified');
    }
  } catch (error: any) {
    throw new Error(
      `Failed to ensure cert applicability unique index: ${error.message}. ` +
      `Cert admin writes (Save Master, Save Vessel, applicability checkbox) will return 500 until this is resolved.`
    );
  }
}

/**
 * Run index migrations to update unique constraints to include vessel_id.
 * This ensures each vessel has independent records with the same codes.
 */
async function runIndexMigrations(db: any): Promise<void> {
  console.log('🔄 Running index migrations...');
  
  try {
    // Migration: Update spares unique constraint to include vessel_id
    // Drop old constraint (without vessel_id) and create new index (with vessel_id)
    await db.execute(sql`ALTER TABLE spares DROP CONSTRAINT IF EXISTS unique_fleet_part_code`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_fleet_part_code_vessel ON spares(fleet_part_code, data_scope, vessel_id)`);
    
    // Migration: Update work_orders unique constraint to include vessel_id
    // Drop old constraint (without vessel_id) and create new index (with vessel_id)
    await db.execute(sql`ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS unique_fleet_job_code`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_fleet_job_code_vessel ON work_orders(fleet_job_code, data_scope, vessel_id)`);

    // Migration: ensure unique_spare_component_link is the 3-column form (spare_id, component_id, vessel_id).
    // The Drizzle baseline (migrations/0000) creates it as 2-col (spare_id, component_id), and the inline
    // migrations 070/071/072 that fix it run BEFORE the table exists on the per-tenant lazy-migration path
    // (runMigrations before runDrizzleMigrations), so fresh tenant DBs stay 2-col. That mismatches the code's
    // onConflictDoNothing target (3-col) → Postgres 42P10 → spare-component link inserts throw (silently dropped).
    // This step runs in initializeDatabase, AFTER the table exists, so it repairs the constraint regardless of
    // migration ordering. Fully idempotent: no-op when already 3-col (RSMS / single-tenant pms_arch); on a 2-col
    // DB it dedups colliding rows first, then drops the wrong constraint and adds the correct 3-col UNIQUE.
    try {
      await db.execute(sql`
        DO $$
        DECLARE
          scl_cols text;
        BEGIN
          -- to_regclass returns NULL (does not throw) if the table is absent.
          IF to_regclass('public.spare_component_links') IS NULL THEN
            RETURN;
          END IF;

          SELECT string_agg(a.attname, ',' ORDER BY array_position(c.conkey, a.attnum)) INTO scl_cols
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
          WHERE c.conname = 'unique_spare_component_link' AND c.conrelid = 'spare_component_links'::regclass;

          IF scl_cols = 'spare_id,component_id,vessel_id' THEN
            RETURN; -- already correct — no-op
          END IF;

          -- Drop any non-3-col constraint or stray index of the same name.
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spare_component_link' AND conrelid = 'spare_component_links'::regclass) THEN
            ALTER TABLE spare_component_links DROP CONSTRAINT unique_spare_component_link;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_spare_component_link' AND tablename = 'spare_component_links') THEN
            DROP INDEX unique_spare_component_link;
          END IF;

          -- Dedup rows that would violate the 3-col uniqueness (keep newest id) so ADD CONSTRAINT can't fail.
          WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY spare_id, component_id, vessel_id
              ORDER BY id DESC
            ) AS rn
            FROM spare_component_links
          )
          DELETE FROM spare_component_links WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

          ALTER TABLE spare_component_links ADD CONSTRAINT unique_spare_component_link UNIQUE (spare_id, component_id, vessel_id);
          RAISE NOTICE 'Repaired unique_spare_component_link to 3-column form (spare_id, component_id, vessel_id)';
        END $$;
      `);
    } catch (sclErr: any) {
      // Never block initialization — log loudly and continue.
      console.error('⚠️  Failed to ensure 3-col unique_spare_component_link constraint:', sclErr?.message || sclErr);
    }

    // Migration: Add vessel_sequence column to vessels table for defect ID generation
    await db.execute(sql`ALTER TABLE vessels ADD COLUMN IF NOT EXISTS vessel_sequence INTEGER`);
    
    // Migration: Add sort_order column to components table for tree view reordering
    await db.execute(sql`ALTER TABLE components ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
    
    // Migration: Create defect_sequences table for tracking per-vessel-per-year defect counters
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS defect_sequences (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        vessel_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        last_sequence INTEGER NOT NULL DEFAULT 0,
        UNIQUE(vessel_id, year)
      )
    `);
    // Note: UNIQUE(vessel_id, year) in CREATE TABLE above already provides the constraint
    // needed for ON CONFLICT. Do NOT create a separate regular index here.
    
    // Migration: Populate vessel_sequence for existing vessels based on creation order
    await db.execute(sql`
      WITH numbered_vessels AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as seq
        FROM vessels
        WHERE vessel_sequence IS NULL
      )
      UPDATE vessels v
      SET vessel_sequence = nv.seq
      FROM numbered_vessels nv
      WHERE v.id = nv.id
    `);
    
    // Migration: Convert existing defects with old format (DEF-timestamp-random) to new format (D{VesselCode}-{YY}-{Seq})
    // This runs once and updates old test data to the new semantic ID format
    const oldFormatDefects = await db.execute(sql`
      SELECT d.id, d.vessel_id, d.created_at
      FROM defects d
      WHERE d.id LIKE 'DEF-%'
      ORDER BY d.vessel_id, d.created_at
    `);
    
    if ((oldFormatDefects.rows as any[]).length > 0) {
      console.log(`🔄 Migrating ${oldFormatDefects.rows.length} defects to new ID format...`);
      
      // Build vessel sequence map from distinct vessel IDs (since vessels table may be empty)
      const vesselSeqMap = new Map<string, number>();
      const distinctVesselIds = [...new Set((oldFormatDefects.rows as any[]).map(r => r.vessel_id))].sort();
      distinctVesselIds.forEach((vid, idx) => vesselSeqMap.set(vid, idx + 1));
      
      // Group defects by vessel and year using nested Map (avoids string splitting issues with UUIDs)
      const defectsByVesselYear = new Map<string, Map<number, { oldId: string; vesselSeq: number; year: number }[]>>();
      
      for (const row of oldFormatDefects.rows as any[]) {
        const vesselId = row.vessel_id;
        const createdAt = new Date(row.created_at);
        const year = createdAt.getFullYear();
        const vesselSeq = vesselSeqMap.get(vesselId) || 1;
        
        if (!defectsByVesselYear.has(vesselId)) {
          defectsByVesselYear.set(vesselId, new Map());
        }
        const yearMap = defectsByVesselYear.get(vesselId)!;
        if (!yearMap.has(year)) {
          yearMap.set(year, []);
        }
        yearMap.get(year)!.push({
          oldId: row.id,
          vesselSeq,
          year,
        });
      }
      
      // Process each vessel-year group
      for (const [vesselId, yearMap] of defectsByVesselYear) {
        for (const [year, defectList] of yearMap) {
          const yearShort = year % 100;
          
          // Check existing sequence for this vessel/year
          const existingSeq = await db.execute(sql`
            SELECT last_sequence FROM defect_sequences 
            WHERE vessel_id = ${vesselId} AND year = ${year}
          `);
          
          let startSeq = existingSeq.rows.length > 0 ? (existingSeq.rows[0] as any).last_sequence + 1 : 1;
          
          // Update each defect with new ID
          for (let i = 0; i < defectList.length; i++) {
            const defect = defectList[i];
            const seqNum = startSeq + i;
            const vesselCode = String(defect.vesselSeq).padStart(3, '0');
            const yearCode = String(yearShort).padStart(2, '0');
            const seqCode = String(seqNum).padStart(4, '0');
            const newId = `D${vesselCode}-${yearCode}-${seqCode}`;
            
            // Update defect ID and any references
            await db.execute(sql`UPDATE defects SET id = ${newId} WHERE id = ${defect.oldId}`);
            await db.execute(sql`UPDATE defect_actions SET defect_id = ${newId} WHERE defect_id = ${defect.oldId}`);
            await db.execute(sql`UPDATE defect_attachments SET defect_id = ${newId} WHERE defect_id = ${defect.oldId}`);
          }
          
          // Update or insert sequence counter
          const finalSeq = startSeq + defectList.length - 1;
          await db.execute(sql`
            INSERT INTO defect_sequences (vessel_id, year, last_sequence)
            VALUES (${vesselId}, ${year}, ${finalSeq})
            ON CONFLICT (vessel_id, year) DO UPDATE SET last_sequence = ${finalSeq}
          `);
        }
      }
      
      console.log('✅ Defect ID migration completed');
    }
    
    console.log('✅ Index migrations completed - unique constraints now include vessel_id');

    // Persistent backfill: keep work_orders.assigned_to_rank_id in lock-step
    // with work_orders.assigned_to (rank-name text) for legacy rows where
    // the rank-id column drifted (was empty, or pointed at a different
    // rank than what the text resolves to). Run on every boot — the WHERE
    // clauses make it a no-op once rows are aligned, so it self-quiesces.
    try {
      const fillMissing = await db.execute(sql`
        UPDATE work_orders wo
        SET assigned_to_rank_id = r.rank_id
        FROM adm_available_ranks r
        WHERE (wo.assigned_to_rank_id IS NULL OR wo.assigned_to_rank_id = '')
          AND wo.assigned_to IS NOT NULL
          AND BTRIM(wo.assigned_to) <> ''
          AND LOWER(BTRIM(wo.assigned_to)) <> 'unassigned'
          AND r.is_deleted = false
          AND (
            LOWER(BTRIM(r.name))  = LOWER(BTRIM(wo.assigned_to)) OR
            LOWER(BTRIM(r.label)) = LOWER(BTRIM(wo.assigned_to))
          )
      `);
      const fixStale = await db.execute(sql`
        UPDATE work_orders wo
        SET assigned_to_rank_id = r.rank_id
        FROM adm_available_ranks r
        WHERE wo.assigned_to_rank_id IS NOT NULL
          AND wo.assigned_to_rank_id <> ''
          AND wo.assigned_to_rank_id <> r.rank_id
          AND wo.assigned_to IS NOT NULL
          AND BTRIM(wo.assigned_to) <> ''
          AND LOWER(BTRIM(wo.assigned_to)) <> 'unassigned'
          AND r.is_deleted = false
          AND (
            LOWER(BTRIM(r.name))  = LOWER(BTRIM(wo.assigned_to)) OR
            LOWER(BTRIM(r.label)) = LOWER(BTRIM(wo.assigned_to))
          )
      `);
      // Reverse direction: where the rank-id is valid but the text is
      // missing/blank, populate the text from the rank dictionary so
      // the Work Orders Assigned To column shows a label rather than
      // appearing unassigned.
      const fillMissingText = await db.execute(sql`
        UPDATE work_orders wo
        SET assigned_to = COALESCE(NULLIF(BTRIM(r.label), ''), r.name)
        FROM adm_available_ranks r
        WHERE wo.assigned_to_rank_id IS NOT NULL
          AND wo.assigned_to_rank_id <> ''
          AND wo.assigned_to_rank_id = r.rank_id
          AND r.is_deleted = false
          AND (
            wo.assigned_to IS NULL
            OR BTRIM(wo.assigned_to) = ''
            OR LOWER(BTRIM(wo.assigned_to)) = 'unassigned'
          )
      `);
      const clearOnUnassign = await db.execute(sql`
        UPDATE work_orders
        SET assigned_to_rank_id = NULL
        WHERE assigned_to_rank_id IS NOT NULL
          AND assigned_to_rank_id <> ''
          AND (
            assigned_to IS NULL
            OR BTRIM(assigned_to) = ''
            OR LOWER(BTRIM(assigned_to)) = 'unassigned'
          )
      `);
      const filled = (fillMissing as any).rowCount ?? 0;
      const corrected = (fixStale as any).rowCount ?? 0;
      const filledText = (fillMissingText as any).rowCount ?? 0;
      const cleared = (clearOnUnassign as any).rowCount ?? 0;
      if (filled || corrected || filledText || cleared) {
        console.log(
          `✅ Work-order assignment backfill: filled=${filled}, corrected=${corrected}, filledText=${filledText}, cleared=${cleared}`
        );
      } else {
        console.log('✅ Work-order assignment backfill: already aligned');
      }
    } catch (e: any) {
      console.error('⚠️ Work-order assignment backfill warning:', e?.message);
    }
  } catch (error: any) {
    console.error('⚠️ Index migration warning:', error.message);
    // Don't throw - these are non-critical migrations that might already be applied
  }
}

export async function initializeDatabase(poolArg?: Pool) {
  try {
    // Phase-1 Part E: optional per-tenant pool; no-arg path resolves the single client as before.
    const postgres = poolArg ? { db: drizzle(poolArg, { schema }) } : await resolvePostgres();
    if (!postgres) {
      console.log('⏭️  Skipping database initialization - DATABASE_URL not configured');
      return false;
    }
    
    const { db } = postgres;
    console.log('🔧 Initializing database tables...');
    
    // Check if tables exist
    const tablesQuery = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableNames = (tablesQuery.rows as any[]).map(r => r.table_name);
    console.log(`📊 Found ${tableNames.length} existing tables:`, tableNames);
    
    // If tables already exist, run migrations and return
    if (tableNames.length > 0 && tableNames.includes('users')) {
      console.log('✅ Database already initialized');
      
      // Run index migrations to update unique constraints to include vessel_id
      await runIndexMigrations(db);
      
      // Seed department master list values (idempotent)
      if (tableNames.includes('master_lists')) {
        const departmentSeeds = [
          { key: 'Engine', value: 'Engine', order: 1 },
          { key: 'Deck', value: 'Deck', order: 2 },
          { key: 'Electrical', value: 'Electrical', order: 3 },
          { key: 'Galley', value: 'Galley', order: 4 },
          { key: 'LSA', value: 'LSA', order: 5 },
          { key: 'FFA', value: 'FFA', order: 6 },
        ];
        for (const dept of departmentSeeds) {
          await db.execute(sql`
            INSERT INTO master_lists (list_type, list_key, list_value, display_order, is_active)
            VALUES ('department', ${dept.key}, ${dept.value}, ${dept.order}, true)
            ON CONFLICT (list_type, list_key) DO UPDATE SET display_order = ${dept.order}
          `);
        }
        console.log('✓ Ensured department master list (6 values)');

        // Seed postponement reason master list values (idempotent — DO NOTHING preserves admin edits)
        for (let i = 0; i < POSTPONEMENT_REASONS.length; i++) {
          const reason = POSTPONEMENT_REASONS[i];
          await db.execute(sql`
            INSERT INTO master_lists (list_type, list_key, list_value, display_order, is_active)
            VALUES ('postponementReason', ${reason}, ${reason}, ${i + 1}, true)
            ON CONFLICT (list_type, list_key) DO NOTHING
          `);
        }
        console.log(`✓ Ensured postponement reason master list (${POSTPONEMENT_REASONS.length} values)`);

        // Seed overdue reason master list values (idempotent — DO NOTHING preserves admin edits)
        for (let i = 0; i < OVERDUE_REASONS.length; i++) {
          const reason = OVERDUE_REASONS[i];
          await db.execute(sql`
            INSERT INTO master_lists (list_type, list_key, list_value, display_order, is_active)
            VALUES ('overdueReason', ${reason}, ${reason}, ${i + 1}, true)
            ON CONFLICT (list_type, list_key) DO NOTHING
          `);
        }
        console.log(`✓ Ensured overdue reason master list (${OVERDUE_REASONS.length} values)`);

        // Migration: Add overdue reason columns to work_orders table
        await db.execute(sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS overdue_reason TEXT`);
        await db.execute(sql`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS overdue_reason_details TEXT`);
        console.log('✓ Ensured overdue_reason and overdue_reason_details columns on work_orders');
      }
      
      return true;
    }
    
    console.log('📝 Creating database schema...');
    
    // Create tables in order (respecting foreign key dependencies)
    
    // 1. Users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `);
    console.log('✓ Created users table');
    
    // 2. Components table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS components (
        id TEXT PRIMARY KEY,
        name TEXT,
        component_code TEXT,
        parent_id TEXT,
        category TEXT,
        current_cumulative_rh DECIMAL(10, 2) NOT NULL DEFAULT 0,
        last_updated TEXT,
        vessel_id TEXT,
        vessel_code TEXT,
        data_scope TEXT NOT NULL DEFAULT 'vessel',
        fleet_equipment_code TEXT,
        fleet_equipment_name TEXT,
        parent_fleet_equipment_code TEXT,
        maker TEXT,
        maker_code TEXT,
        model TEXT,
        model_number TEXT,
        model_code TEXT,
        serial_no TEXT,
        drawing_no TEXT,
        department TEXT,
        dept_category TEXT,
        component_category TEXT,
        location TEXT,
        eqpt_system_dept TEXT,
        commissioned_date TEXT,
        installation_date TEXT,
        critical BOOLEAN DEFAULT false,
        class_item BOOLEAN DEFAULT false,
        condition_based BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        rating TEXT,
        no_of_units TEXT,
        parent_component TEXT,
        dimensions_size TEXT,
        notes TEXT,
        running_hours DECIMAL(10, 2),
        applicable_vessel_ids TEXT[],
        scope_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Created components table');
    
    // Add indexes for components
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comp_data_scope ON components(data_scope)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comp_fleet_tree ON components(data_scope, parent_fleet_equipment_code)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comp_vessel_tree ON components(data_scope, vessel_id, parent_id)`);
    // NOTE: fleetEquipmentCode is NOT unique - multiple components can share the same fleet equipment code/name
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comp_fleet_equipment_code ON components(fleet_equipment_code)`);
    
    // 3. Work Orders table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS work_orders (
        id TEXT PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        template_code TEXT,
        component_code TEXT,
        component_id TEXT,
        component_name TEXT,
        job_name TEXT NOT NULL,
        job_code TEXT,
        job_id TEXT,
        job_description TEXT,
        job_interval_type TEXT,
        job_interval_value INTEGER,
        job_frequency TEXT,
        job_type TEXT NOT NULL DEFAULT 'planned',
        last_done_date TEXT,
        last_done_rh DECIMAL(10, 2),
        next_due_date TEXT,
        next_due_rh DECIMAL(10, 2),
        next_due_counter DECIMAL(10, 2),
        counter_type TEXT,
        category TEXT,
        priority TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        assigned_to TEXT,
        assigned_rank TEXT,
        est_manhours DECIMAL(10, 2),
        planned_start_date TEXT,
        planned_completion_date TEXT,
        actual_start_date TEXT,
        actual_completion_date TEXT,
        completion_date TEXT,
        completion_rh DECIMAL(10, 2),
        completed_by TEXT,
        approval_status TEXT,
        approved_by TEXT,
        approved_date TEXT,
        work_instructions TEXT,
        safety_precautions TEXT,
        completion_remarks TEXT,
        spares_used JSONB,
        attachments TEXT[],
        linked_defect_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reschedule_count INTEGER DEFAULT 0,
        reschedule_reason TEXT,
        is_overdue BOOLEAN DEFAULT false,
        department TEXT,
        sub_category TEXT,
        work_done TEXT,
        delay_reason TEXT,
        postponed_to TEXT,
        postpone_reason TEXT,
        linked_wo_ids TEXT[],
        overdue_reason TEXT,
        overdue_reason_details TEXT
      )
    `);
    console.log('✓ Created work_orders table');
    
    // Add indexes for work orders
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wo_vessel ON work_orders(vessel_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wo_component ON work_orders(component_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wo_next_due ON work_orders(next_due_date)`);
    
    // 4. Spares table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spares (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        part_code TEXT NOT NULL,
        part_name TEXT NOT NULL,
        component_id TEXT,
        component_code TEXT,
        component_name TEXT NOT NULL,
        component_spare_code TEXT,
        critical TEXT NOT NULL,
        rob INTEGER NOT NULL DEFAULT 0,
        min INTEGER NOT NULL DEFAULT 0,
        location TEXT,
        vessel_id TEXT,
        deleted BOOLEAN NOT NULL DEFAULT false,
        data_scope TEXT NOT NULL DEFAULT 'vessel',
        fleet_equipment_code TEXT,
        fleet_part_code TEXT,
        part_number TEXT,
        uom TEXT,
        drawing_number TEXT,
        position_number TEXT,
        note TEXT,
        specification TEXT,
        maker TEXT,
        maker_code TEXT,
        model TEXT,
        manual_name TEXT,
        page_number TEXT,
        criticality TEXT,
        is_active BOOLEAN DEFAULT true,
        ihm TEXT,
        evidence_type TEXT,
        part_category TEXT,
        applicable_vessel_ids TEXT[],
        scope_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Created spares table');
    
    // Add indexes for spares
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spare_component ON spares(component_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spare_vessel ON spares(vessel_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spare_code ON spares(vessel_id, component_spare_code)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spare_data_scope ON spares(data_scope)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spare_fleet_equipment ON spares(data_scope, fleet_equipment_code)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_fleet_part_code_vessel ON spares(fleet_part_code, data_scope, vessel_id)`);
    
    // 5. Defects table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS defects (
        id TEXT PRIMARY KEY,
        vessel_id TEXT NOT NULL,
        defect_number TEXT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        sub_category TEXT,
        component_id TEXT,
        component_code TEXT,
        component_name TEXT,
        location TEXT,
        equipment_key TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        is_critical BOOLEAN DEFAULT false,
        is_coc BOOLEAN DEFAULT false,
        coc_condition TEXT,
        immediate_cause TEXT,
        root_cause TEXT,
        corrective_action TEXT,
        preventive_action TEXT,
        reported_date TEXT NOT NULL,
        reported_by TEXT NOT NULL,
        reported_by_rank TEXT,
        assigned_to TEXT,
        assigned_rank TEXT,
        target_completion_date TEXT,
        actual_completion_date TEXT,
        closed_date TEXT,
        closed_by TEXT,
        estimated_manhours DECIMAL(10, 2),
        actual_manhours DECIMAL(10, 2),
        linked_work_order_id TEXT,
        linked_defect_ids TEXT[],
        attachments TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        department TEXT,
        safety_impact TEXT,
        operational_impact TEXT,
        downtime_hours DECIMAL(10, 2),
        spares_required JSONB,
        verification_status TEXT,
        verified_by TEXT,
        verified_date TEXT,
        recurring_indicator BOOLEAN DEFAULT false,
        parent_defect_id TEXT,
        occurrence_count INTEGER DEFAULT 1
      )
    `);
    console.log('✓ Created defects table');
    
    // Add indexes for defects
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_defect_vessel ON defects(vessel_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_defect_component ON defects(component_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_defect_status ON defects(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_defect_priority ON defects(priority)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_defect_coc ON defects(is_coc)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_defect_equipment ON defects(equipment_key)`);
    
    // 6. Additional essential tables
    
    // Running Hours Audit
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS running_hours_audit (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        vessel_id TEXT NOT NULL,
        component_id TEXT NOT NULL,
        previous_rh DECIMAL(10, 2) NOT NULL,
        new_rh DECIMAL(10, 2) NOT NULL,
        cumulative_rh DECIMAL(10, 2) NOT NULL,
        date_updated_local TEXT NOT NULL,
        date_updated_tz TEXT NOT NULL,
        entered_at_utc TIMESTAMP NOT NULL,
        user_id TEXT NOT NULL,
        source TEXT NOT NULL,
        notes TEXT,
        meter_replaced BOOLEAN NOT NULL DEFAULT false,
        old_meter_final DECIMAL(10, 2),
        new_meter_start DECIMAL(10, 2),
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_component_entered ON running_hours_audit(component_id, entered_at_utc)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_component_date ON running_hours_audit(component_id, date_updated_local)`);
    console.log('✓ Created running_hours_audit table');
    
    // Defect Actions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS defect_actions (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        defect_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_description TEXT NOT NULL,
        action_date TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        manhours DECIMAL(10, 2),
        spares_used JSONB,
        attachments TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_action_defect ON defect_actions(defect_id)`);
    console.log('✓ Created defect_actions table');
    
    // Defect Attachments
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS defect_attachments (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        defect_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        uploaded_by TEXT NOT NULL,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_attachment_defect ON defect_attachments(defect_id)`);
    console.log('✓ Created defect_attachments table');
    
    // Change Requests
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS change_request (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        vessel_id TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        reason TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_by TEXT NOT NULL,
        requested_date TEXT NOT NULL,
        reviewed_by TEXT,
        reviewed_date TEXT,
        approved_by TEXT,
        approved_date TEXT,
        rejection_reason TEXT,
        changes_json JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cr_vessel ON change_request(vessel_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cr_status ON change_request(status)`);
    console.log('✓ Created change_request table');
    
    // Change Request Comments
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS change_request_comment (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        change_request_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comment_cr ON change_request_comment(change_request_id)`);
    console.log('✓ Created change_request_comment table');
    
    // Form Definitions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS form_definitions (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        name TEXT NOT NULL UNIQUE,
        subgroup TEXT
      )
    `);
    console.log('✓ Created form_definitions table');
    
    // Form Versions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS form_versions (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        form_id INTEGER NOT NULL,
        version_no INTEGER NOT NULL,
        version_date TIMESTAMP NOT NULL,
        status TEXT NOT NULL,
        author_user_id TEXT NOT NULL,
        changelog TEXT,
        schema_json TEXT NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_form_id ON form_versions(form_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_status ON form_versions(status)`);
    console.log('✓ Created form_versions table');
    
    // Spares History
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS spares_history (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        timestamp_utc TIMESTAMP NOT NULL,
        vessel_id TEXT NOT NULL,
        spare_id INTEGER NOT NULL,
        part_code TEXT NOT NULL,
        part_name TEXT NOT NULL,
        component_id TEXT NOT NULL,
        component_code TEXT,
        component_name TEXT NOT NULL,
        component_spare_code TEXT,
        event_type TEXT NOT NULL,
        qty_change INTEGER NOT NULL,
        rob_after INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        remarks TEXT,
        reference TEXT,
        date_local TEXT,
        tz TEXT,
        place TEXT
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_history_timestamp ON spares_history(timestamp_utc)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_history_spare ON spares_history(spare_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_history_event ON spares_history(event_type)`);
    console.log('✓ Created spares_history table');
    
    // Makers
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS makers (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        maker_code TEXT NOT NULL UNIQUE,
        maker_name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Created makers table');
    
    // Master Lists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS master_lists (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        list_type TEXT NOT NULL,
        list_value TEXT NOT NULL,
        display_order INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_list_type ON master_lists(list_type)`);
    console.log('✓ Created master_lists table');

    const departmentSeeds = [
      { key: 'Engine', value: 'Engine', order: 1 },
      { key: 'Deck', value: 'Deck', order: 2 },
      { key: 'Electrical', value: 'Electrical', order: 3 },
      { key: 'Galley', value: 'Galley', order: 4 },
      { key: 'LSA', value: 'LSA', order: 5 },
      { key: 'FFA', value: 'FFA', order: 6 },
    ];
    for (const dept of departmentSeeds) {
      await db.execute(sql`
        INSERT INTO master_lists (list_type, list_key, list_value, display_order, is_active)
        VALUES ('department', ${dept.key}, ${dept.value}, ${dept.order}, true)
        ON CONFLICT (list_type, list_key) DO UPDATE SET display_order = ${dept.order}
      `);
    }
    console.log('✓ Seeded department master list (6 values)');

    // Seed postponement reason master list (fresh-schema path, idempotent)
    for (let i = 0; i < POSTPONEMENT_REASONS.length; i++) {
      const reason = POSTPONEMENT_REASONS[i];
      await db.execute(sql`
        INSERT INTO master_lists (list_type, list_key, list_value, display_order, is_active)
        VALUES ('postponementReason', ${reason}, ${reason}, ${i + 1}, true)
        ON CONFLICT (list_type, list_key) DO NOTHING
      `);
    }
    console.log(`✓ Seeded postponement reason master list (${POSTPONEMENT_REASONS.length} values)`);

    // Seed overdue reason master list (fresh-schema path, idempotent)
    for (let i = 0; i < OVERDUE_REASONS.length; i++) {
      const reason = OVERDUE_REASONS[i];
      await db.execute(sql`
        INSERT INTO master_lists (list_type, list_key, list_value, display_order, is_active)
        VALUES ('overdueReason', ${reason}, ${reason}, ${i + 1}, true)
        ON CONFLICT (list_type, list_key) DO NOTHING
      `);
    }
    console.log(`✓ Seeded overdue reason master list (${OVERDUE_REASONS.length} values)`);

    // Alert Policies
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS alert_policies (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        vessel_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        metric TEXT NOT NULL,
        threshold_value DECIMAL(10, 2) NOT NULL,
        operator TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        notify_roles TEXT[],
        notify_emails TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Created alert_policies table');
    
    // Alert History
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS alert_history (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        policy_id INTEGER NOT NULL,
        vessel_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        metric TEXT NOT NULL,
        actual_value DECIMAL(10, 2) NOT NULL,
        threshold_value DECIMAL(10, 2) NOT NULL,
        triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_by TEXT,
        acknowledged_at TIMESTAMP
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_alert_policy ON alert_history(policy_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_alert_triggered ON alert_history(triggered_at)`);
    console.log('✓ Created alert_history table');
    
    // Ensure immutability trigger for component_maintenance_history
    await ensureMaintenanceHistoryImmutability();
    
    console.log('✅ Database initialization complete! All tables created successfully.');
    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

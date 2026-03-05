import { sql } from 'drizzle-orm';
import { resolvePostgres } from './postgresClient';
import { isFileStorageForced } from './storageFactory';

/**
 * Ensure immutability trigger exists for component_maintenance_history
 * This function is idempotent and can be called multiple times safely
 * 
 * Behavior:
 * - File-storage mode (forced or no DATABASE_URL): Skips trigger creation, returns void
 * - PostgreSQL mode: Creates/verifies triggers, throws on failure
 * 
 * IMPORTANT: This function throws if trigger creation fails in PostgreSQL mode
 * to ensure immutability is enforced before serving traffic.
 */
export async function ensureMaintenanceHistoryImmutability(): Promise<void> {
  console.log('🔒 Ensuring immutability trigger for component_maintenance_history...');
  
  // Check if file-based storage is forced (skip PostgreSQL operations)
  if (isFileStorageForced()) {
    console.log('⏭️  Skipping immutability trigger setup - file-based storage is active');
    return;
  }
  
  // Attempt to resolve PostgreSQL client
  const postgres = await resolvePostgres();
  
  // File-storage mode - skip trigger creation
  if (!postgres) {
    console.log('⏭️  Skipping immutability trigger setup - DATABASE_URL not configured (using file-based storage)');
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
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_defect_seq_vessel_year ON defect_sequences(vessel_id, year)`);
    
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
  } catch (error: any) {
    console.error('⚠️ Index migration warning:', error.message);
    // Don't throw - these are non-critical migrations that might already be applied
  }
}

export async function initializeDatabase() {
  try {
    // Lazy load database client using resolver
    const postgres = await resolvePostgres();
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
        linked_wo_ids TEXT[]
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

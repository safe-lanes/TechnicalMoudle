/**
 * Run Migrations 038-039: Spares suuid + child spare_uuid columns + FK constraints
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

interface MigDef { id: string; name: string; sql: string; }

const migrations: MigDef[] = [
  {
    id: '038_spare_suuid_column',
    name: 'Add suuid column to spares',
    sql: `
      ALTER TABLE spares ADD COLUMN IF NOT EXISTS suuid TEXT;
      UPDATE spares SET suuid = gen_random_uuid()::text WHERE suuid IS NULL;
      ALTER TABLE spares ALTER COLUMN suuid SET NOT NULL;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_suuid_unique') THEN
          ALTER TABLE spares ADD CONSTRAINT spares_suuid_unique UNIQUE(suuid);
        END IF;
      END $$
    `
  },
  {
    id: '039_spare_child_uuid_columns_and_fk_constraints',
    name: 'Add spare_uuid columns to 4 child tables + FK constraints',
    sql: `
      ALTER TABLE spares_history ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE spares_history sh SET spare_uuid = s.suuid FROM spares s WHERE sh.spare_id = s.id AND sh.spare_uuid IS NULL;

      ALTER TABLE spare_component_links ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE spare_component_links scl SET spare_uuid = s.suuid FROM spares s WHERE scl.spare_id = s.id AND scl.spare_uuid IS NULL;
      ALTER TABLE spare_component_links ALTER COLUMN spare_uuid SET NOT NULL;

      ALTER TABLE spare_location_stock ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE spare_location_stock sls SET spare_uuid = s.suuid FROM spares s WHERE sls.spare_id = s.id AND sls.spare_uuid IS NULL;
      ALTER TABLE spare_location_stock ALTER COLUMN spare_uuid SET NOT NULL;

      ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS spare_uuid TEXT;
      UPDATE inventory_transactions it SET spare_uuid = s.suuid FROM spares s WHERE it.spare_id = s.id AND it.spare_uuid IS NULL;
      ALTER TABLE inventory_transactions ALTER COLUMN spare_uuid SET NOT NULL;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spares_history_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE spares_history ADD CONSTRAINT spares_history_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_component_links_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE spare_component_links ADD CONSTRAINT spare_component_links_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spare_location_stock_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE spare_location_stock ADD CONSTRAINT spare_location_stock_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_spare_uuid_spares_suuid_fk') THEN
          ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_spare_uuid_spares_suuid_fk FOREIGN KEY (spare_uuid) REFERENCES spares(suuid);
        END IF;
      END $$
    `
  }
];

async function run() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  console.log('🔗 Connected to PostgreSQL');

  for (const mig of migrations) {
    const check = await db.execute(sql.raw(`SELECT id FROM schema_migrations WHERE id = '${mig.id}'`));
    if (check.rows.length > 0) { console.log(`⏭️  ${mig.id} already applied`); continue; }

    console.log(`\n🔄 Running ${mig.id}: ${mig.name}...`);
    try {
      await db.execute(sql.raw(mig.sql));
      await db.execute(sql`INSERT INTO schema_migrations (id, name, description, applied_at) VALUES (${mig.id}, ${mig.name}, ${mig.name}, NOW()) ON CONFLICT (id) DO NOTHING`);
      console.log(`  ✅ ${mig.id} applied successfully`);
    } catch (error: any) {
      console.error(`  ❌ ${mig.id} FAILED:`, error.message);
      await pool.end();
      process.exit(1);
    }
  }

  // Verify
  console.log('\n📋 Verification...');

  // Verify suuid
  const spareSample = await db.execute(sql.raw(`SELECT id, suuid FROM spares LIMIT 5`));
  console.log('Sample spares (id → suuid):');
  for (const s of spareSample.rows) {
    const r = s as any;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.suuid);
    console.log(`  ${r.id} → ${r.suuid} ${isUuid ? '✅ UUID' : '❌ not UUID'}`);
  }

  // Verify child spare_uuid populated
  const childTables = ['spare_component_links', 'spare_location_stock', 'inventory_transactions'];
  for (const t of childTables) {
    const total = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${t}`));
    const nulls = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${t} WHERE spare_uuid IS NULL`));
    const sample = await db.execute(sql.raw(`SELECT spare_id, spare_uuid FROM ${t} LIMIT 2`));
    console.log(`\n${t}: ${(total.rows[0] as any).cnt} rows, ${(nulls.rows[0] as any).cnt} NULL spare_uuid`);
    for (const s of sample.rows) {
      const r = s as any;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.spare_uuid);
      console.log(`  spare_id=${r.spare_id} → spare_uuid=${r.spare_uuid} ${isUuid ? '✅' : '❌'}`);
    }
  }

  // Verify FK constraints
  const fks = await db.execute(sql.raw(`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'spares' AND ccu.column_name = 'suuid'
    ORDER BY tc.table_name
  `));
  console.log(`\n✅ Found ${fks.rows.length} FK constraints referencing spares(suuid)`);
  for (const fk of fks.rows) {
    const r = fk as any;
    console.log(`  ✅ ${r.table_name} → spares.suuid  [${r.constraint_name}]`);
  }

  await pool.end();
  console.log('\n✅ All migrations (038-039) complete');
  process.exit(0);
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });

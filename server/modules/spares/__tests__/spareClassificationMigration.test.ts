import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { getPool } from '../../../db';
import { runDrizzleMigrations } from '../../../migrations';
import type { Pool } from 'pg';

const migrationId = '184_spare_category_optimum_qty';
const migration = readFileSync(`migrations/${migrationId}.sql`, 'utf8');

describe('file-based spare classification migration', () => {
  it('tracks once, replays cleanly, preserves future legacy rows and inventory; failed batch retries atomically', async () => {
    const pool = await getPool();
    const client = await pool.connect();
    const schema = `test_spare_classification_${Date.now()}`;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query(`
        CREATE TABLE schema_migrations (id varchar(255) PRIMARY KEY, name varchar(255) NOT NULL, description text, applied_at timestamp DEFAULT now());
        CREATE TABLE spares (id integer PRIMARY KEY, rob integer, min integer, max integer, critical text, spare_category text, optimum_qty integer);
        CREATE TABLE fleet_spares (id integer PRIMARY KEY, criticality text, spare_category text, optimum_qty integer);
        CREATE TABLE master_list_types (mltuuid text UNIQUE, list_type_key text UNIQUE, label text, section text, is_system boolean, is_active boolean, display_order integer);
        CREATE TABLE master_lists (list_type text, list_key text, list_value text, display_order integer, UNIQUE(list_type,list_key));
        INSERT INTO spares VALUES (1, 12, 2, 20, 'Yes', NULL, NULL), (2, 8, 1, 9, 'No', 'optimum', NULL);
        INSERT INTO fleet_spares VALUES (1, 'Yes', NULL, NULL);
      `);
      // Mark unrelated migrations already applied, to exercise the real file runner.
      for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql') && f !== `${migrationId}.sql`)) {
        await client.query('INSERT INTO schema_migrations(id,name) VALUES($1,$1)', [file.replace('.sql', '')]);
      }
      const adapter = { query: client.query.bind(client) } as unknown as Pool;
      await expect(runDrizzleMigrations(adapter)).rejects.toThrow();
      expect((await client.query("SELECT * FROM schema_migrations WHERE id = '184_spare_category_optimum_qty_backfill'")).rows).toHaveLength(0);
      expect((await client.query('SELECT spare_category FROM spares WHERE id=1')).rows[0].spare_category).toBeNull();
      await client.query('UPDATE spares SET optimum_qty=3 WHERE id=2');
      expect((await runDrizzleMigrations(adapter)).applied).toBe(1);
      const before = (await client.query('SELECT * FROM spares ORDER BY id')).rows;
      expect(before[0]).toMatchObject({ rob: 12, min: 2, max: 20, critical: 'Yes', spare_category: 'general', optimum_qty: null });
      expect(before[1]).toMatchObject({ spare_category: 'optimum', optimum_qty: 3 });
      await client.query("INSERT INTO spares VALUES (3,0,0,NULL,'No',NULL,NULL); INSERT INTO fleet_spares VALUES(2,'No',NULL,NULL)");
      expect((await runDrizzleMigrations(adapter)).applied).toBe(0);
      await client.query(migration);
      await client.query(migration);
      // Either pre-merge SQL revision's marker must protect future legacy rows.
      await client.query("DELETE FROM schema_migrations WHERE id='184_spare_category_optimum_qty_backfill'");
      await client.query(migration);
      await client.query("DELETE FROM schema_migrations WHERE id='184_spare_category_backfill_once'");
      await client.query(migration);
      expect((await client.query('SELECT * FROM spares WHERE id<3 ORDER BY id')).rows).toEqual(before);
      expect((await client.query('SELECT spare_category,optimum_qty FROM spares WHERE id=3')).rows[0]).toEqual({ spare_category: null, optimum_qty: null });
      expect((await client.query('SELECT spare_category FROM fleet_spares WHERE id=2')).rows[0].spare_category).toBeNull();
      expect((await client.query('SELECT * FROM master_lists')).rows).toHaveLength(3);
      expect((await client.query('SELECT * FROM master_list_types')).rows).toHaveLength(1);
      await expect(client.query("UPDATE spares SET spare_category='optimum' WHERE id=3")).rejects.toThrow();
      await expect(client.query('UPDATE spares SET optimum_qty=1 WHERE id=3')).rejects.toThrow();
      expect((await client.query("SELECT column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='spares' AND column_name='spare_category'", [schema])).rows[0].column_default).toBeNull();
    } finally {
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  }, 60000);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { getPool } from '../../server/db';

test('migration: populated data, raw replay, future legacy NULLs, rollback/retry and SQL checks', async () => {
  const pool = await getPool();
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    // All objects are transaction-local temporary tables; no application data is changed.
    await conn.query(`
      CREATE TEMP TABLE spares(id integer PRIMARY KEY, rob integer, min integer, updated_at timestamp DEFAULT '2020-01-01');
      CREATE TEMP TABLE fleet_spares(id integer PRIMARY KEY, updated_at timestamp DEFAULT '2020-01-01');
      CREATE TEMP TABLE master_list_types(mltuuid text UNIQUE, list_type_key text UNIQUE, label text, section text, is_system boolean, display_order integer);
      CREATE TEMP TABLE master_lists(list_type text,list_key text,list_value text,display_order integer,UNIQUE(list_type,list_key));
      CREATE TEMP TABLE schema_migrations(id text PRIMARY KEY,name text,description text);
      CREATE TRIGGER test_spare_stamp BEFORE UPDATE ON spares FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
      CREATE TRIGGER test_fleet_spare_stamp BEFORE UPDATE ON fleet_spares FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
      INSERT INTO spares(id,rob,min) VALUES(1,17,3);
      INSERT INTO fleet_spares(id) VALUES(1);
    `);
    const migration = await readFile('migrations/184_spare_category_optimum_qty.sql', 'utf8');
    await conn.query('SAVEPOINT migration_attempt');
    await conn.query(migration);
    await conn.query('ROLLBACK TO SAVEPOINT migration_attempt');
    assert.equal((await conn.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n, 0);
    await conn.query(migration);
    assert.deepEqual((await conn.query('SELECT spare_category,optimum_qty,rob,min FROM spares WHERE id=1')).rows[0],
      { spare_category: 'general', optimum_qty: null, rob: 17, min: 3 });
    assert.equal((await conn.query('SELECT spare_category FROM fleet_spares WHERE id=1')).rows[0].spare_category, 'general');
    assert.equal((await conn.query("SELECT count(*)::int AS n FROM spares WHERE updated_at='2020-01-01'")).rows[0].n, 1);
    assert.equal((await conn.query("SELECT count(*)::int AS n FROM fleet_spares WHERE updated_at='2020-01-01'")).rows[0].n, 1);
    await conn.query('INSERT INTO spares(id,rob,min) VALUES(2,4,1); INSERT INTO fleet_spares(id) VALUES(2)');
    await conn.query(migration);
    assert.equal((await conn.query('SELECT spare_category FROM spares WHERE id=2')).rows[0].spare_category, null);
    assert.equal((await conn.query('SELECT spare_category FROM fleet_spares WHERE id=2')).rows[0].spare_category, null);
    assert.equal((await conn.query('SELECT count(*)::int AS n FROM master_lists')).rows[0].n, 3);
    for (const invalid of ["spare_category='optimum',optimum_qty=NULL", "spare_category=NULL,optimum_qty=1",
      "spare_category='essential',optimum_qty=2", "spare_category='optimum',optimum_qty=0"]) {
      await conn.query('SAVEPOINT invalid_pair');
      await assert.rejects(conn.query(`UPDATE spares SET ${invalid} WHERE id=2`), /check constraint/);
      await conn.query('ROLLBACK TO SAVEPOINT invalid_pair');
    }
    await conn.query("UPDATE spares SET spare_category='optimum',optimum_qty=5 WHERE id=2");
    assert.equal((await conn.query('SELECT optimum_qty FROM spares WHERE id=2')).rows[0].optimum_qty, 5);
  } finally {
    await conn.query('ROLLBACK');
    conn.release();
    await pool.end();
  }
});

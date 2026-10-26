import { describe, it, expect } from 'vitest';
import { getPool } from '../../../db';
import { applySparePairLogs, validateIncomingSparePair } from '../spareClassificationSync';
import { resolveSparePairConflict } from '../spareClassificationConflict';
import { readFileSync } from 'node:fs';

describe('spare pair sync and conflict regression', () => {
  it('merges omissions, applies/clears atomically, rejects bad partials and scope, preserves duplicates and resolves stale pairs', async () => {
    const pool = await getPool();
    const client = await pool.connect();
    const schema = `test_spare_sync_${Date.now()}`;
    const instance = process.env.SYNC_INSTANCE_ID || 'SHORE-DEV';
    try {
      await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}", public`);
      await client.query(`
        CREATE TABLE spares (suuid text PRIMARY KEY, vessel_id text, spare_category text, optimum_qty integer, updated_at timestamp,
          rob integer DEFAULT 8, min integer DEFAULT 2, critical text DEFAULT 'Yes',
          CHECK (CASE WHEN spare_category='optimum' THEN optimum_qty IS NOT NULL AND optimum_qty>0 ELSE optimum_qty IS NULL END));
        CREATE TABLE master_lists (list_type text,list_key text,is_deleted boolean DEFAULT false);
        INSERT INTO master_lists VALUES ('spareCategory','general',false),('spareCategory','essential',false),('spareCategory','optimum',false);
        CREATE TABLE sync_field_log (id serial PRIMARY KEY,table_name text,row_uuid text,field_name text,
          old_value text,new_value text,vessel_id text,changed_at timestamp DEFAULT now(),changed_by_user_id text,changed_by_display text,
          instance_id text,is_synced boolean DEFAULT false,is_sync boolean DEFAULT false);
        INSERT INTO spares(suuid,vessel_id,spare_category,optimum_qty) VALUES('spare-1','vessel-1','general',NULL);
      `);
      await client.query(readFileSync('migrations/111_sync_conflict_log_and_field_index.sql', 'utf8'));
      const log = (fieldName: string, oldValue: string | null, newValue: string | null, extra = {}) => ({
        tableName: 'spares', rowUuid: 'spare-1', vesselId: 'vessel-1', fieldName, oldValue, newValue,
        changedAt: '2026-10-01T10:00:00Z', instanceId: 'SHIP-TEST', ...extra,
      });
      const apply = async (logs: any[]) => {
        await client.query('BEGIN');
        const result = await applySparePairLogs(client, logs, instance, 'batch-test');
        await client.query('COMMIT');
        return result;
      };
      const row = async () => (await client.query("SELECT * FROM spares WHERE suuid='spare-1'")).rows[0];
      expect(await validateIncomingSparePair(client, {}, await row())).toEqual({ spareCategory: 'general', optimumQty: null });
      expect(await validateIncomingSparePair(client, {})).toEqual({ spareCategory: null, optimumQty: null });
      const optimum = [log('spareCategory', 'general', 'optimum'), log('optimumQty', null, '4')];
      expect((await apply(optimum)).errors).toEqual([]);
      expect(await row()).toMatchObject({ spare_category: 'optimum', optimum_qty: 4, rob: 8, min: 2, critical: 'Yes' });
      expect((await apply(optimum)).errors).toEqual([]);
      expect((await client.query('SELECT * FROM sync_field_log')).rows).toHaveLength(0); // no echo
      const invalid = await apply([log('spareCategory', 'optimum', 'essential')]);
      expect(invalid.failedRows.has('spare-1')).toBe(true);
      expect(await row()).toMatchObject({ spare_category: 'optimum', optimum_qty: 4 });
      expect((await apply([log('optimumQty', '4', '5', { vesselId: 'other-vessel' })])).failedRows.has('spare-1')).toBe(true);
      const essential = [log('spareCategory', 'optimum', 'essential'), log('optimumQty', '4', null)];
      expect((await apply(essential)).errors).toEqual([]);
      expect(await row()).toMatchObject({ spare_category: 'essential', optimum_qty: null });
      await client.query(`INSERT INTO sync_field_log(table_name,row_uuid,field_name,changed_at,instance_id)
        VALUES('spares','spare-1','spareCategory','2026-10-02',$1)`, [instance]);
      expect((await apply(optimum)).errors).toEqual([]);
      expect(await row()).toMatchObject({ spare_category: 'essential', optimum_qty: null });
      const conflicts = (await client.query('SELECT * FROM sync_conflict_log WHERE is_resolved=false ORDER BY id')).rows;
      expect(new Set(conflicts.map(c => c.field_name))).toEqual(new Set(['spareCategory', 'optimumQty']));
      const adapter = { connect: async () => ({ query: client.query.bind(client), release() {} }) };
      await resolveSparePairConflict(adapter, conflicts[0], 'log', 'test-operator', true);
      expect(await row()).toMatchObject({ spare_category: 'optimum', optimum_qty: 4, rob: 8 });
      expect((await client.query('SELECT * FROM sync_conflict_log WHERE is_resolved=false')).rows).toHaveLength(0);
      // A deliberately mixed-side invalid pair cannot be committed or marked resolved.
      await client.query(`INSERT INTO sync_conflict_log(table_name,row_uuid,field_name,incoming_new_value,incoming_changed_at)
        VALUES('spares','spare-1','spareCategory','essential','2026-10-03')`);
      const bad = (await client.query('SELECT * FROM sync_conflict_log WHERE is_resolved=false')).rows[0];
      await expect(resolveSparePairConflict(adapter, bad, 'log', 'test-operator', true)).rejects.toThrow('blank');
      expect(await row()).toMatchObject({ spare_category: 'optimum', optimum_qty: 4 });
      expect((await client.query('SELECT * FROM sync_conflict_log WHERE id=$1', [bad.id])).rows[0].is_resolved).toBe(false);
    } finally {
      await client.query('ROLLBACK');
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  }, 60000);
});

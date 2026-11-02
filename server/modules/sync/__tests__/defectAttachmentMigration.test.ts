import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shouldRetryUnknownSyncColumn } from '../unknownColumnRetryPolicy';
import { getPool } from '../../../db';
import { SyncEngine } from '../syncEngine';

describe('defect C1 mixed-version migration', () => {
  it('retries the exact new column without changing unrelated legacy skip policy', () => {
    expect(shouldRetryUnknownSyncColumn('defects', 'part_c_attachments')).toBe(true);
    expect(shouldRetryUnknownSyncColumn('defects', 'unrelated_future_column')).toBe(false);
    expect(shouldRetryUnknownSyncColumn('other', 'part_c_attachments')).toBe(false);
    expect(shouldRetryUnknownSyncColumn('spares', 'spare_category')).toBe(true);
  });
  it('both real receiver paths leave the unknown C1 field unacknowledged', () => {
    const push = readFileSync('server/modules/sync/service.ts', 'utf8');
    const pull = readFileSync('server/modules/sync/syncEngine.ts', 'utf8');
    expect(push).toMatch(/shouldRetryUnknownSyncColumn\(log.tableName, fieldNameSnake\)[\s\S]*?droppedRowUuids.add\(log.rowUuid\)[\s\S]*?continue;/);
    expect(pull).toMatch(/shouldRetryUnknownSyncColumn\(log.tableName, fieldNameSnake\)[\s\S]*?throw new Error\(/);
  });
  it('migration replays without copying legacy data and permits the held field afterward', async () => {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`CREATE TEMP TABLE defects (duuid text PRIMARY KEY, attachments json, closure_files text[]) ON COMMIT DROP`);
      await client.query(`INSERT INTO defects VALUES ('d', '[{"id":"b"}]', ARRAY['b'])`);
      await client.query('ALTER TABLE pg_temp.defects ADD COLUMN updated_at timestamp');
      // Exercise the real pull receiver, redirecting metadata inspection to this
      // connection's temporary schema. Never change live business rows.
      const receiver = Object.create(SyncEngine.prototype) as any;
      receiver.instanceId = 'SHIP-TEST';
      const conn = {
        query: (text: string, values?: any[]) => client.query(text
          .replaceAll("n.nspname = 'public'", 'n.oid = pg_my_temp_schema()')
          .replaceAll("table_schema = 'public'", 'table_schema = (SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema())'), values),
      };
      const log = { tableName: 'defects', rowUuid: 'd', fieldName: 'partCAttachments',
        oldValue: null, newValue: '[{"id":"c"}]', changedAt: new Date().toISOString(), instanceId: 'SHORE-TEST' };
      await expect(receiver.applyFieldLog(log, conn)).rejects.toThrow('Retryable unknown column defects.part_c_attachments');
      const migration = readFileSync('migrations/191_defect_part_c_attachments.sql', 'utf8');
      expect(migration).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/i);
      await client.query(migration);
      await client.query(migration);
      expect((await client.query('SELECT * FROM pg_temp.defects')).rows[0])
        .toMatchObject({ attachments: [{ id: 'b' }], closure_files: ['b'], part_c_attachments: [] });
      await expect(receiver.applyFieldLog(log, conn)).resolves.toBeUndefined();
      expect((await client.query('SELECT * FROM pg_temp.defects')).rows[0])
        .toMatchObject({ attachments: [{ id: 'b' }], closure_files: ['b'], part_c_attachments: [{ id: 'c' }] });
      // Old vessels still send Part B evidence IDs directly through sync;
      // the API's new-selection validation must not reject those received logs.
      await client.query(`UPDATE pg_temp.defects SET closure_files = '{}'`);
      await expect(receiver.applyFieldLog({ ...log, fieldName: 'closureFiles', newValue: '["b"]' }, conn))
        .resolves.toBeUndefined();
      expect((await client.query('SELECT closure_files FROM pg_temp.defects')).rows[0].closure_files).toEqual(['b']);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

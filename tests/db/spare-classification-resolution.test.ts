import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPool } from '../../server/db';
import { applyClassificationEvent, resolveClassificationConflict } from '../../server/modules/sync/spareClassificationSync';
import { RESOLUTION_ACTOR } from '../../server/modules/sync/dualCompletionResolver';

// Two independent database sessions model installations without touching application tables.
const setup = `
  CREATE TEMP TABLE spares(suuid text PRIMARY KEY,vessel_id text,spare_category text,optimum_qty integer,updated_at timestamp);
  CREATE TEMP TABLE sync_field_log(
    table_name text,row_uuid text,field_name text,old_value text,new_value text,vessel_id text,
    changed_by_user_id text,changed_by_display text,instance_id text,is_synced boolean,is_sync boolean,changed_at timestamp);
  CREATE TEMP TABLE sync_conflict_log(
    id serial PRIMARY KEY,batch_uuid text,table_name text,row_uuid text,field_name text,
    incoming_sender_instance text,incoming_changed_at timestamp,incoming_old_value text,incoming_new_value text,
    receiver_winner_instance text,receiver_winner_changed_at timestamp,receiver_current_value text,
    is_resolved boolean DEFAULT false,resolved_at timestamp,resolved_by text,resolved_action text);
  CREATE TEMP TABLE sync_conflicts(
    conflict_uuid text,table_name text,row_uuid text,field_name text,resolution text,
    resolved_at timestamp,resolved_by text,resolved_value text,updated_at timestamp);
`;

test('two installations converge for Apply Incoming AND Dismiss, despite newer local edits; mirrors close without echo', async () => {
  const pool = await getPool();
  const shore = await pool.connect(), vessel = await pool.connect();
  try {
    await shore.query(setup);
    await vessel.query(setup);
    for (const incoming of [true, false]) {
      for (const conn of [shore, vessel]) await conn.query(
        'TRUNCATE spares,sync_field_log,sync_conflict_log,sync_conflicts RESTART IDENTITY');
      await shore.query("INSERT INTO spares VALUES('pair-test','vessel','optimum',8,NOW())");
      await vessel.query("INSERT INTO spares VALUES('pair-test','vessel','essential',NULL,NOW())");
      for (const conn of [shore, vessel]) {
        await conn.query(`
          INSERT INTO sync_conflict_log(table_name,row_uuid,field_name,incoming_sender_instance,
            incoming_changed_at,incoming_new_value)
          VALUES('spares','pair-test','spareCategory','vessel-test','2026-01-01','essential'),
                ('spares','pair-test','optimumQty','vessel-test','2026-01-01',NULL);
          INSERT INTO sync_conflicts(conflict_uuid,table_name,row_uuid,field_name)
          VALUES('legacy-mirror','spares','pair-test','spareCategory');
        `);
      }
      // Clock skew / a receiver-local edit newer than the resolving installation's
      // clock must not turn an explicit user decision into fresh ordinary conflicts.
      await vessel.query(`
        INSERT INTO sync_field_log(table_name,row_uuid,field_name,new_value,instance_id,changed_at)
        VALUES('spares','pair-test','spareCategory','essential','vessel-test','2099-01-01'),
              ('spares','pair-test','optimumQty',NULL,'vessel-test','2099-01-01');
      `);
      const conflict = (await shore.query('SELECT * FROM sync_conflict_log WHERE id=1')).rows[0];
      await resolveClassificationConflict(
        { connect: async () => ({ query: shore.query.bind(shore), release() {} }) },
        conflict, 'human-office-reviewer', incoming,
      );
      const emitted = (await shore.query('SELECT * FROM sync_field_log ORDER BY field_name')).rows;
      assert.equal(emitted.length, 2);
      assert.ok(emitted.every(row => row.changed_by_user_id === RESOLUTION_ACTOR));
      assert.ok(emitted.every(row => row.changed_by_display === 'human-office-reviewer'));
      const logs = emitted.map(row => ({
        tableName: row.table_name, rowUuid: row.row_uuid, fieldName: row.field_name,
        newValue: row.new_value, oldValue: row.old_value, instanceId: row.instance_id,
        changedAt: row.changed_at, changedByUserId: row.changed_by_user_id,
      }));
      for (let retry = 0; retry < 2; retry++) {
        await vessel.query('BEGIN');
        for (const log of logs) {
          assert.equal(await applyClassificationEvent(vessel, log, logs, 'vessel-test', 'batch',
            async () => ({ skip: false })), true);
        }
        await vessel.query('COMMIT');
      }
      const source = (await shore.query('SELECT spare_category,optimum_qty FROM spares')).rows[0];
      const received = (await vessel.query('SELECT spare_category,optimum_qty FROM spares')).rows[0];
      assert.deepEqual(received, source);
      assert.deepEqual(source, incoming
        ? { spare_category: 'essential', optimum_qty: null }
        : { spare_category: 'optimum', optimum_qty: 8 });
      assert.equal((await vessel.query('SELECT count(*)::int AS n FROM sync_conflict_log WHERE is_resolved=false')).rows[0].n, 0);
      assert.equal((await vessel.query('SELECT count(*)::int AS n FROM sync_conflict_log')).rows[0].n, 2);
      assert.equal((await vessel.query('SELECT resolution FROM sync_conflicts')).rows[0].resolution, 'remote_resolution');
      assert.equal((await vessel.query('SELECT count(*)::int AS n FROM sync_field_log')).rows[0].n, 2);
    }
  } finally {
    await shore.query('ROLLBACK');
    await vessel.query('ROLLBACK');
    // Release/destroy both connections, ensuring temporary fixtures disappear.
    shore.release(true);
    vessel.release(true);
    await pool.end();
  }
});

/**
 * UNTRACKED REPAIR SCRIPT — re-offer old dead-lettered / never-logged records so the
 * ship's truth reaches shore and the Work Order dashboards converge.
 *
 * RUN ON THE SHIP (the side that holds the truth). DRY-RUN by default; nothing is
 * written without --apply.
 *
 * Classification per (table, uuid):
 *   CLASS A — has field logs with is_synced=false        → pending; nothing to do, just sync
 *   CLASS B — has logs, ALL is_synced=true (dead-letter) → re-offer (is_synced=false, attempts=0)
 *   CLASS C — has NO logs at all (never-logged write)    → synthesize full-row UPDATE-origin logs
 *   MISSING — row not on this DB                          → reported, never touched
 *
 * Why synthetic logs are UPDATE-origin (old_value = marker, NOT NULL): the shore's
 * INSERT-origin guard terminal-acks creation logs against populated columns; update-origin
 * logs flow through the per-field stale-skip and apply. A row missing on shore triggers the
 * absent-row full-row self-heal, so both stale AND missing shore rows converge.
 *
 * Usage (ship):
 *   npx tsx scripts/repair-wo-deadletter-reoffer.ts --wo <wouuid>[,<wouuid>...]        # dry-run
 *   npx tsx scripts/repair-wo-deadletter-reoffer.ts --file list.txt                    # one id per line; "table:uuid" for non-WO tables
 *   npx tsx scripts/repair-wo-deadletter-reoffer.ts --wo ... --apply                   # execute
 *
 * Family handling: for each wouuid, component_maintenance_history rows with
 * work_order_id = wouuid are auto-included (a completion is a family, not one row).
 * running_hours_audit has no direct WO column — pass "running_hours_audit:<rhauuid>"
 * explicitly if a specific audit row must travel.
 *
 * After --apply: run Sync Now (repeat until DRAIN COMPLETE), then re-diff the two sides.
 */
import { Pool } from 'pg';
import fs from 'fs';

const SKIP_FIELDS = new Set(['updated_at', 'created_at', 'is_sync', 'sync_attempts', 'last_attempt_at']);
const SYNTH_MARKER = 'REPAIR-SYNTHETIC-REOFFER'; // old_value provenance; non-null = update-origin by design

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag: string) => { const i = a.indexOf(flag); return i >= 0 ? a[i + 1] : undefined; };
  const ids: Array<{ table: string; uuid: string }> = [];
  const wo = get('--wo');
  if (wo) for (const u of wo.split(',').map(s => s.trim()).filter(Boolean)) ids.push({ table: 'work_orders', uuid: u });
  const file = get('--file');
  if (file) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const [t, u] = line.includes(':') ? line.split(':') : ['work_orders', line];
    ids.push({ table: t.trim(), uuid: u.trim() });
  }
  return { ids, apply: a.includes('--apply'), db: get('--db') || process.env.DATABASE_URL };
}

const IDENTITY: Record<string, string> = {
  work_orders: 'wouuid',
  component_maintenance_history: 'cmhuuid',
  running_hours_audit: 'rhauuid',
};

async function serialColumns(pool: Pool, table: string): Promise<Set<string>> {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = $1 AND (is_identity = 'YES' OR column_default LIKE 'nextval%')`, [table]);
  return new Set(r.rows.map((x: any) => x.column_name));
}

function serialize(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

async function main() {
  const { ids, apply, db } = parseArgs();
  if (!ids.length || !db) {
    console.log('Usage: npx tsx scripts/repair-wo-deadletter-reoffer.ts --wo <wouuid,...> [--file list.txt] [--apply]');
    console.log('DATABASE_URL must point at the SHIP DB.');
    process.exit(2);
  }
  const pool = new Pool({ connectionString: db });

  // Same precedence as the app (syncRole.getEffectiveInstanceId): DB first, env fallback.
  const inst = await pool.query(`SELECT setting_value FROM sync_settings WHERE setting_key='instance_id'`);
  const instanceId: string = (inst.rows[0]?.setting_value?.trim()) || process.env.SYNC_INSTANCE_ID || '';
  if (!instanceId.toUpperCase().startsWith('SHIP-')) {
    console.log(`ABORT: resolved instance is '${instanceId || '(none)'}' (DB then env) — not a ship. Run on the SHIP DB only.`);
    process.exit(1);
  }
  console.log(`Ship instance: ${instanceId}   mode: ${apply ? '⚠️ APPLY' : 'dry-run'}\n`);

  // Family expansion: completions span work_orders + component_maintenance_history.
  const work = [...ids];
  for (const { table, uuid } of ids) {
    if (table !== 'work_orders') continue;
    const fam = await pool.query(`SELECT cmhuuid FROM component_maintenance_history WHERE work_order_id = $1`, [uuid]);
    for (const row of fam.rows) work.push({ table: 'component_maintenance_history', uuid: row.cmhuuid });
    if (fam.rows.length) console.log(`family: ${uuid} → +${fam.rows.length} component_maintenance_history row(s)`);
  }

  const summary = { A: 0, B: 0, C: 0, MISSING: 0 };
  for (const { table, uuid } of work) {
    const idCol = IDENTITY[table];
    if (!idCol) { console.log(`SKIP ${table}:${uuid} — table not in this script's identity map (extend IDENTITY if intended)`); continue; }

    const rowRes = await pool.query(`SELECT * FROM "${table}" WHERE "${idCol}" = $1 LIMIT 1`, [uuid]);
    if (!rowRes.rows.length) { console.log(`MISSING  ${table}:${uuid} — row not on this DB (untouched; investigate separately)`); summary.MISSING++; continue; }
    const row = rowRes.rows[0];

    const logs = await pool.query(
      `SELECT is_synced, count(*)::int AS n FROM sync_field_log WHERE table_name=$1 AND row_uuid=$2 GROUP BY 1`, [table, uuid]);
    const unsynced = logs.rows.find((r: any) => r.is_synced === false)?.n ?? 0;
    const synced = logs.rows.find((r: any) => r.is_synced === true)?.n ?? 0;

    if (unsynced > 0) {
      console.log(`CLASS A  ${table}:${uuid} — ${unsynced} log(s) already pending; will deliver on next sync. No action.`);
      summary.A++;
    } else if (synced > 0) {
      console.log(`CLASS B  ${table}:${uuid} — ${synced} log(s) all marked synced (dead-letter pattern) → re-offer`);
      summary.B++;
      if (apply) {
        const upd = await pool.query(
          `UPDATE sync_field_log SET is_synced=false, sync_attempts=0, last_attempt_at=NULL
            WHERE table_name=$1 AND row_uuid=$2 AND is_synced=true`, [table, uuid]);
        console.log(`         re-offered ${upd.rowCount} log(s)`);
      }
    } else {
      const serials = await serialColumns(pool, table);
      const fields = Object.entries(row).filter(([k, v]) =>
        !SKIP_FIELDS.has(k) && !serials.has(k) && k !== 'is_synced' && v !== null && v !== undefined);
      console.log(`CLASS C  ${table}:${uuid} — NO logs exist (never-logged write) → synthesize ${fields.length} full-row UPDATE-origin log(s)`);
      summary.C++;
      if (apply) {
        let n = 0;
        for (const [col, val] of fields) {
          await pool.query(
            `INSERT INTO sync_field_log
               (table_name, row_uuid, field_name, old_value, new_value, vessel_id, changed_at,
                changed_by_user_id, changed_by_display, instance_id, is_synced)
             VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,false)`,
            [table, uuid, col, SYNTH_MARKER, serialize(val), row.vessel_id ?? null,
             'repair-script', 'Repair re-offer (synthetic)', instanceId]);
          n++;
        }
        console.log(`         wrote ${n} synthetic log(s)`);
      }
    }
  }

  console.log(`\n==== SUMMARY: A(pending)=${summary.A}  B(re-offered)=${summary.B}  C(synthesized)=${summary.C}  MISSING=${summary.MISSING} ====`);
  if (!apply) console.log('Dry-run only — re-run with --apply to execute, then Sync Now until DRAIN COMPLETE.');
  await pool.end();
}

main().catch(e => { console.error('REPAIR ERROR:', e?.message || e); process.exit(1); });

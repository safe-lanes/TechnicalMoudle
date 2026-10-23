#!/usr/bin/env node
// TRACKED pilot harness (13-Oct-2026): component_documents UUID identity (mig 182) through the REAL rollout order —
// the shore is updated first, a ship keeps running the previous version until its night update.
//
//   node local-test-env/verify-component-documents-uuid.cjs prepare # shore = OLD, ship = OLD (a shared document)
//   (update the shore)
//   node local-test-env/verify-component-documents-uuid.cjs mixed   # shore = new code, ship = OLD code
//   (update the ship in place, keeping its database)                  # e.g. docker cp new code + docker restart
//   node local-test-env/verify-component-documents-uuid.cjs after   # shore = new, ship = new
//   node local-test-env/verify-component-documents-uuid.cjs fresh   # both new: the original collision case
//
// State between phases: local-test-env/.verify-cduuid-state.json (untracked). Pilot data is labelled "cduuid probe".
// Shore :5000 (pms_arch, .env.shore.example); ship docker $SHIP_CONTAINER :5100. Exit 1 if any check fails.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = process.env.PMS_ROOT || 'C:/Users/GhaziAnwer/TechnicalMoudle';
const jwt = require(path.join(root, 'node_modules', 'jsonwebtoken'));
const { Client } = require(path.join(root, 'node_modules', 'pg'));
const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86';
const SHIP_CONTAINER = process.env.SHIP_CONTAINER || 'pms-ship-mix';
const STATE = path.join(root, 'local-test-env/.verify-cduuid-state.json');
const phase = process.argv[2];

const env = (f) => Object.fromEntries(fs.readFileSync(path.join(root, f), 'utf8').split(/\r?\n/)
  .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2].split(' #')[0].trim().replace(/^"|"$/g, '')]));
const SH = env('local-test-env/.env.shore.example');
const SP = env('local-test-env/.env.ship.example');
const BASE = { shore: 'http://127.0.0.1:5000/technical/api', ship: 'http://127.0.0.1:5100/technical/api' };
const TOK = {
  shore: jwt.sign({ id: 'cduuid-probe', domain: 'pilot', userType: 'Office', role: 'Sail Admin' }, SH.JWT_SECRET || 'x', { expiresIn: '30m' }),
  ship: jwt.sign({ id: 'cduuid-probe', domain: 'pilot', userType: 'Office', role: 'Sail Admin' }, SP.JWT_SECRET || 'x', { expiresIn: '30m' }),
};
const H = (side) => ({ authorization: `Bearer ${TOK[side]}`, 'x-user-role': 'Sail Admin', 'x-user-type': 'Office', 'x-user-id': 'cduuid-probe' });
const md5Uuid = (t) => { const h = crypto.createHash('md5').update(t, 'utf8').digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
let db;
const shore = async (sql, p) => (await db.query(sql, p)).rows;
function ship(sql) {
  const out = execFileSync('docker', ['exec', '-i', SHIP_CONTAINER, 'su', 'postgres', '-c', 'psql -d pms_arch_ship -At -F "|" -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }).trim();
  return out ? out.split('\n').map((l) => l.split('|')) : [];
}
const shipHasCol = () => ship(`SELECT count(*) FROM information_schema.columns WHERE table_name='component_documents' AND column_name='cduuid';`)[0][0] === '1';
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
async function upload(side, comp, name) {
  const fd = new FormData();
  fd.append('file', new Blob([`${name} — pilot probe file`], { type: 'text/plain' }), `${name.replace(/[^a-z0-9-]/gi, '_')}.txt`);
  for (const [k, v] of Object.entries({ componentId: comp.cuuid, componentCode: comp.component_code, vesselCode: comp.vessel_code, fileName: name, fileType: 'Manual', canShipView: 'true' })) fd.append(k, v);
  const r = await fetch(`${BASE[side]}/component-documents`, { method: 'POST', body: fd, headers: H(side) });
  const j = await r.json().catch(() => null);
  if (r.status !== 200 && r.status !== 201) throw new Error(`${side} upload HTTP ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  return j;
}
async function edit(side, id, notes) {
  const r = await fetch(`${BASE[side]}/component-documents/${id}`, { method: 'PUT', body: JSON.stringify({ notes }), headers: { ...H(side), 'content-type': 'application/json' } });
  if (r.status !== 200) throw new Error(`${side} edit HTTP ${r.status}`);
}
async function sync() {
  const r = await fetch(`${BASE.ship}/sync/trigger`, { method: 'POST', body: JSON.stringify({ vesselId: V }), headers: { ...H('ship'), 'content-type': 'application/json' } });
  return r.json();
}
const docsByName = async (like) => ({
  shore: await shore(`SELECT id, cduuid, file_name, file_key, coalesce(notes,'') notes FROM component_documents WHERE file_name LIKE $1 ORDER BY file_name`, [like]),
  ship: ship(`SELECT id, ${shipHasCol() ? 'cduuid' : "''"}, file_name, file_key, coalesce(notes,'') FROM component_documents WHERE file_name LIKE '${like.replace(/'/g, "''")}' ORDER BY file_name;`)
    .map(([id, cduuid, file_name, file_key, notes]) => ({ id: Number(id), cduuid, file_name, file_key, notes })),
});

(async () => {
  db = new Client({ connectionString: SH.DATABASE_URL }); await db.connect();
  try {
    const comp = (await shore(`SELECT cuuid, component_code, vessel_code FROM components WHERE vessel_id=$1 AND coalesce(is_deleted,false)=false ORDER BY cuuid LIMIT 1`, [V]))[0];
    if (phase === 'prepare') {
      // BOTH sides still on the OLD version: the office uploads a document and the ship receives it — the state every
      // existing shared document is in at upgrade time (old code inserts it under the SENDER's id on both sides).
      check('setup: ship runs the OLD version (no cduuid column)', !shipHasCol());
      const tag = `cduuid probe ${Date.now()}`;
      await upload('shore', comp, `${tag} SHARED`);
      const r = await sync();
      const d = await docsByName(`${tag} SHARED`);
      check('prepare: shared document on both sides with the same file (ids may differ)', d.shore.length === 1 && d.ship.length === 1 && d.shore[0].file_key === d.ship[0].file_key,
        `shore id ${d.shore[0]?.id}, ship id ${d.ship[0]?.id}; ${String(r.error || 'no errors').slice(0, 80)}`);
      fs.writeFileSync(STATE, JSON.stringify({ tag, sharedId: d.ship[0]?.id, sharedShoreId: d.shore[0]?.id, sharedFileKey: d.ship[0]?.file_key }, null, 2));
    } else if (phase === 'mixed') {
      check('setup: ship runs the OLD version (no cduuid column)', !shipHasCol());
      const prep = JSON.parse(fs.readFileSync(STATE, 'utf8'));
      const tag = prep.tag;
      // The office (already updated) must have given the shared document the derived UUID too.
      const sharedShore = (await shore(`SELECT cduuid FROM component_documents WHERE id=$1`, [prep.sharedShoreId]))[0];
      check('mixed: shore backfilled the shared document with the derived UUID', sharedShore?.cduuid === md5Uuid(`component_documents:${prep.sharedFileKey}:${comp.cuuid}:1`), sharedShore?.cduuid);
      const shared = { id: prep.sharedId };
      const o1 = await upload('shore', comp, `${tag} OFFICE`);
      const s1 = await upload('ship', comp, `${tag} SHIP`);
      const sharedNote = `ship edit ${Date.now()}`;
      await edit('ship', shared.id, sharedNote);
      const r1 = await sync(); const r2 = await sync();
      const d = await docsByName(`${tag}%`);
      const shipS1 = d.ship.find((x) => x.file_name.endsWith('SHIP'));
      const shoreS1 = d.shore.find((x) => x.file_name.endsWith('SHIP'));
      check('mixed: ship sync still succeeds (no aborted pull)', r1.success === true && r2.success === true, `errors: ${String(r2.error || r1.error || 'none').slice(0, 140)}`);
      check('mixed: office document NOT sent to the old ship yet (held back)', !d.ship.some((x) => x.file_name.endsWith('OFFICE')), `ship has ${d.ship.length} probe docs`);
      check('mixed: held-back change shows as still to receive', (r2.remainingPull ?? 0) > 0, `remainingPull ${r2.remainingPull}`);
      const expect = shipS1 ? md5Uuid(`component_documents:${shipS1.file_key}:${comp.cuuid}:1`) : null;
      check('mixed: old ship\'s new document arrives on shore under the derived UUID', !!shoreS1 && shoreS1.cduuid === expect, `shore ${shoreS1?.cduuid} vs expected ${expect}`);
      if (sharedNote) {
        const shoreShared = (await shore(`SELECT coalesce(notes,'') notes FROM component_documents WHERE id=$1`, [prep.sharedShoreId]))[0];
        const pend = Number(ship(`SELECT count(*) FROM sync_field_log WHERE table_name='component_documents' AND row_uuid='${shared.id}' AND is_synced=false;`)[0][0]);
        check('mixed: old ship\'s EDIT of a shared document waits (not applied to a guessed row)', shoreShared.notes !== sharedNote && pend > 0, `shore notes "${shoreShared.notes.slice(0, 30)}", ship pending logs ${pend}`);
      }
      fs.writeFileSync(STATE, JSON.stringify({ ...prep, o1: o1.cduuid, s1ShipId: shipS1?.id, sharedNote }, null, 2));
    } else if (phase === 'after') {
      const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
      check('setup: ship runs the NEW version (cduuid column)', shipHasCol());
      const r1 = await sync(); const r2 = await sync();
      const d = await docsByName(`${st.tag}%`);
      check('after: syncs succeed without document errors', r1.success && r2.success && !/component_documents/.test(String(r1.error || '') + String(r2.error || '')), String(r2.error || r1.error || 'no errors').slice(0, 160));
      const sh = Object.fromEntries(d.shore.map((x) => [x.file_name, x.cduuid]));
      const sp = Object.fromEntries(d.ship.map((x) => [x.file_name, x.cduuid]));
      check('after: office document now on the ship, same UUID', !!sp[`${st.tag} OFFICE`] && sp[`${st.tag} OFFICE`] === sh[`${st.tag} OFFICE`], `ship ${sp[`${st.tag} OFFICE`]} / shore ${sh[`${st.tag} OFFICE`]}`);
      check('after: ship document has the SAME UUID on both sides (ship backfill = shore derivation)', !!sp[`${st.tag} SHIP`] && sp[`${st.tag} SHIP`] === sh[`${st.tag} SHIP`], `ship ${sp[`${st.tag} SHIP`]} / shore ${sh[`${st.tag} SHIP`]}`);
      check('after: each probe document exactly once per side', d.shore.length === 3 && d.ship.length === 3, `shore ${d.shore.length}, ship ${d.ship.length}`);
      if (st.sharedNote) {
        const n = (await shore(`SELECT coalesce(notes,'') notes FROM component_documents WHERE id=$1`, [st.sharedShoreId]))[0].notes;
        check('after: the ship\'s waiting edit of the shared document arrived', n === st.sharedNote, `shore notes "${n.slice(0, 40)}"`);
      }
      const pend = Number(ship(`SELECT count(*) FROM sync_field_log WHERE table_name='component_documents' AND is_synced=false;`)[0][0]);
      check('after: nothing left waiting for documents on the ship', pend === 0, `ship pending ${pend}`);
      // Every document present on BOTH sides (same stored file) must carry the same UUID. (Documents only on the shore —
      // e.g. uploaded before this ship was provisioned — are not compared: provisioning does not copy documents.)
      const vc = comp.vessel_code;
      const shoreAll = await shore(`SELECT file_key, cduuid FROM component_documents WHERE vessel_code=$1`, [vc]);
      const shipAll = new Map(ship(`SELECT file_key, cduuid FROM component_documents WHERE vessel_code='${vc}';`).map((r) => [r[0], r[1]]));
      const common = shoreAll.filter((r) => shipAll.has(r.file_key));
      const mismatched = common.filter((r) => shipAll.get(r.file_key) !== r.cduuid);
      check('after: every document on both sides carries the same UUID', common.length > 0 && mismatched.length === 0, `${common.length} common, ${mismatched.length} mismatched`);
    } else if (phase === 'fresh') {
      check('setup: ship runs the NEW version (cduuid column)', shipHasCol());
      const tag = `cduuid probe fresh ${Date.now()}`;
      await upload('shore', comp, `${tag} OFFICE`);
      await upload('ship', comp, `${tag} SHIP`);
      const r = await sync();
      const d = await docsByName(`${tag}%`);
      check('fresh: office + ship uploads between syncs — BOTH documents on BOTH sides', d.shore.length === 2 && d.ship.length === 2, `shore ${d.shore.length}, ship ${d.ship.length}; ${String(r.error || 'no errors').slice(0, 100)}`);
      const same = d.shore.every((x) => d.ship.some((y) => y.cduuid === x.cduuid && y.file_name === x.file_name));
      check('fresh: same UUID per document on both sides', same);
    } else {
      console.error('usage: verify-component-documents-uuid.cjs prepare|mixed|after|fresh'); process.exit(2);
    }
  } finally { await db.end(); }
  const failed = results.filter((x) => !x).length;
  console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASS'} (${results.length} checks, phase ${phase})`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

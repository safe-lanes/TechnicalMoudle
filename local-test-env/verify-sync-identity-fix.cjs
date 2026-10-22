#!/usr/bin/env node
// TRACKED pilot harness (13-Oct-2026): the Testvessel sync fixes on the real shore+ship pilot.
//   shore = host process :5000 on pms_arch (local-test-env/.env.shore.example)
//   ship  = docker container $SHIP_CONTAINER (default pms-ship-fix) :5100, DB pms_arch_ship
// Vessel WK Frontier Pilot 743ef9d1…; run AFTER provisioning. Makes pilot data (CRs, defects) labelled "identity-fix probe".
// Temporarily enables Level 1 approval for component CRs on both sides and restores the previous setting at the end.
// Tokens are minted with each side's pilot JWT_SECRET (never printed). Exit code 1 if any check fails.
//
//   T1 approval created on SHIP for a ship CR    → arrives on shore, linked to the SHORE's local CR id
//   T2 approval created on SHORE for an office CR → arrives on ship, linked to the SHIP's local CR id
//   T3 office approves T2's step                  → status reaches the ship, link unchanged
//   T4 office + ship raise a defect between syncs → office O-series, ship plain series, both present both sides
//   T5 FIXTURE number clash (old-style data)      → shore keeps its own defect untouched, incoming kept pending
//   T6 no sync errors other than T5's deliberate clash; nothing written for defect_sequences
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = process.env.PMS_ROOT || 'C:/Users/GhaziAnwer/TechnicalMoudle';
const jwt = require(path.join(root, 'node_modules', 'jsonwebtoken'));
const { Client } = require(path.join(root, 'node_modules', 'pg'));
const V = '743ef9d1-841a-11ed-aa7c-7003bca91a86';
const SHIP_CONTAINER = process.env.SHIP_CONTAINER || 'pms-ship-fix';
const TAG = `identity-fix probe ${new Date().toISOString().slice(0, 16)}`;

function env(file) {
  const o = {};
  for (const l of fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
    if (m) o[m[1]] = m[2].split(' #')[0].trim().replace(/^"|"$/g, '');
  }
  return o;
}
const SHORE_ENV = env('local-test-env/.env.shore.example');
const SHIP_ENV = env('local-test-env/.env.ship.example');
const tok = (e) => jwt.sign({ id: 'identity-fix-probe', domain: 'pilot', userType: 'Office', role: 'Sail Admin' }, e.JWT_SECRET || 'x', { expiresIn: '30m' });
const SIDES = {
  shore: { base: 'http://127.0.0.1:5000/technical/api', token: tok(SHORE_ENV) },
  ship: { base: 'http://127.0.0.1:5100/technical/api', token: tok(SHIP_ENV) },
};
async function api(side, method, p, body) {
  const s = SIDES[side];
  const r = await fetch(s.base + p, { method, headers: { authorization: 'Bearer ' + s.token, 'x-user-role': 'Sail Admin', 'x-user-type': 'Office', 'x-user-id': 'identity-fix-probe', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
let shoreDb;
async function shore(sql, params) { return (await shoreDb.query(sql, params)).rows; }
function ship(sql) {
  const out = execFileSync('docker', ['exec', '-i', SHIP_CONTAINER, 'su', 'postgres', '-c', 'psql -d pms_arch_ship -At -F "|" -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }).trim();
  return out ? out.split('\n').map((l) => l.split('|')) : [];
}
const sq = (v) => `'${String(v).replace(/'/g, "''")}'`;
const results = [];
function check(name, ok, detail) { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
async function sync() {
  const r = await api('ship', 'POST', '/sync/trigger', { vesselId: V });
  return r.body || {};
}

(async () => {
  shoreDb = new Client({ connectionString: SHORE_ENV.DATABASE_URL });
  await shoreDb.connect();
  const cfgSql = `SELECT variable_name, level1_enabled FROM approval_workflow_config WHERE function_id='pms-components-cr' ORDER BY 1`;
  const prevShore = await shore(cfgSql);
  const prevShip = ship(cfgSql + ';');
  await shore(`UPDATE approval_workflow_config SET level1_enabled=true WHERE function_id='pms-components-cr'`);
  ship(`UPDATE approval_workflow_config SET level1_enabled=true WHERE function_id='pms-components-cr';`);
  try {
    const comp = (await shore(`SELECT cuuid FROM components WHERE vessel_id=$1 AND coalesce(is_deleted,false)=false ORDER BY cuuid LIMIT 1`, [V]))[0].cuuid;
    const crBody = (who) => ({ vesselId: V, category: 'components', title: `${who} CR — ${TAG}`, reason: TAG, targetType: 'component', targetId: comp, status: 'submitted', requestedByUserId: 'identity-fix-probe' });

    // FIXTURE (stated): make local CR numbers DIFFER the way they do in production — the shore holds every vessel's
    // change requests, a ship only its own (Testvessel: shore 74, ship 2). Without this, a freshly provisioned pilot
    // ship has the same numbers as the shore and the old code passes by coincidence.
    const bumped = (await shore(`SELECT setval(pg_get_serial_sequence('change_request','id'), (SELECT max(id) FROM change_request) + 500) AS v`))[0].v;
    console.log(`FIXTURE: shore change_request numbering moved ahead to ${bumped} (as if other vessels' CRs existed)`);
    const shipCr = (await api('ship', 'POST', '/change-requests', crBody('SHIP'))).body;
    const officeCr = (await api('shore', 'POST', '/change-requests', crBody('OFFICE'))).body;
    console.log(`ship CR local id ${shipCr.id} (${shipCr.cruuid}), office CR local id ${officeCr.id} (${officeCr.cruuid})`);

    const s1 = await sync();
    const s2 = await sync();
    const errs = [s1.error, s2.error].filter(Boolean).join(' | ');

    const stepQ = (cruuid) => `SELECT a.crauuid, a.change_request_id, cr.id AS local_cr_id, cr.cruuid = a.change_request_uuid AS same_parent, a.status
      FROM change_request_approval a JOIN change_request cr ON cr.id = a.change_request_id WHERE a.change_request_uuid = '${cruuid}'`;
    // T1
    const t1Shore = await shore(stepQ(shipCr.cruuid));
    const shoreLocalShipCr = (await shore(`SELECT id FROM change_request WHERE cruuid=$1`, [shipCr.cruuid]))[0]?.id;
    check('T1 ship approval step arrives on shore, linked to the shore\'s own CR id', t1Shore.length === 1 && t1Shore[0].same_parent === true && t1Shore[0].change_request_id === shoreLocalShipCr,
      `shore CR id ${shoreLocalShipCr}, step points at ${t1Shore[0]?.change_request_id}`);
    // T2
    const t2Ship = ship(stepQ(officeCr.cruuid) + ';');
    const shipLocalOfficeCr = ship(`SELECT id FROM change_request WHERE cruuid=${sq(officeCr.cruuid)};`)[0]?.[0];
    check('T2 office approval step arrives on ship, linked to the ship\'s own CR id', t2Ship.length === 1 && t2Ship[0][3] === 't' && t2Ship[0][1] === shipLocalOfficeCr,
      `ship CR id ${shipLocalOfficeCr} (office id ${officeCr.id}), step points at ${t2Ship[0]?.[1]}`);
    check('T1/T2 sync finished without approval errors', !/change_request_approval/.test(errs), errs || 'no errors');

    // T7 — comments/attachments land on the RIGHT change request on the other side (mig 181)
    const shipCrIdOnShip = ship(`SELECT id FROM change_request WHERE cruuid=${sq(shipCr.cruuid)};`)[0]?.[0];
    await api('ship', 'POST', `/change-requests/${shipCrIdOnShip}/comments`, { userId: 'identity-fix-probe', message: `SHIP comment — ${TAG}` });
    await api('ship', 'POST', `/change-requests/${shipCrIdOnShip}/attachments`, { filename: `ship-${Date.now()}.pdf`, url: 'https://example.com/identity-fix-probe.pdf', uploadedByUserId: 'identity-fix-probe' });
    await api('shore', 'POST', `/change-requests/${officeCr.id}/comments`, { userId: 'identity-fix-probe', message: `OFFICE comment — ${TAG}` });
    await sync();
    const childQ = (kind, cruuid) => kind === 'comment'
      ? `SELECT count(*) FROM change_request_comment c JOIN change_request cr ON cr.id = c.change_request_id WHERE c.message LIKE '%${TAG}%' AND cr.cruuid = '${cruuid}'`
      : `SELECT count(*) FROM change_request_attachment a JOIN change_request cr ON cr.id = a.change_request_id WHERE a.url = 'https://example.com/identity-fix-probe.pdf' AND cr.cruuid = '${cruuid}'`;
    const shoreShipComment = Number((await shore(childQ('comment', shipCr.cruuid)))[0].count);
    const shoreShipAttach = Number((await shore(childQ('attachment', shipCr.cruuid)))[0].count);
    const shipOfficeComment = Number(ship(childQ('comment', officeCr.cruuid) + ';')[0][0]);
    check('T7 ship comment + attachment are on the same change request in the office', shoreShipComment === 1 && shoreShipAttach >= 1, `comment ${shoreShipComment}, attachment ${shoreShipAttach}`);
    check('T7 office comment is on the same change request on the ship', shipOfficeComment === 1, `comment ${shipOfficeComment}`);

    // T3
    const appr = await api('shore', 'PUT', `/change-requests/${officeCr.id}/approve`, { comment: TAG, reviewerId: 'identity-fix-probe', role: 'Sail Admin' });
    await sync();
    const t3 = ship(stepQ(officeCr.cruuid) + ';');
    check('T3 office approval reaches the ship, link unchanged', appr.status === 200 && t3[0]?.[4] === 'Approved' && t3[0]?.[1] === shipLocalOfficeCr,
      `approve HTTP ${appr.status}, ship step status ${t3[0]?.[4]}, points at ${t3[0]?.[1]}`);

    // T4
    const vName = (await shore(`SELECT name FROM vessels WHERE vuuid=$1`, [V]))[0]?.name || 'WK Frontier Pilot';
    const dBody = (who) => ({ vesselId: V, vesselName: vName, issueDate: new Date().toISOString().slice(0, 10), category: 'Defect', description: `${who} defect — ${TAG}`, status: 'Open', critical: false, reportedBy: 'identity-fix-probe' });
    const seqLogsBefore = Number((await shore(`SELECT count(*) FROM sync_field_log WHERE table_name='defect_sequences'`))[0].count);
    const odr = await api('shore', 'POST', '/defects', dBody('OFFICE'));
    const sdr = await api('ship', 'POST', '/defects', dBody('SHIP'));
    const od = odr.body || {};
    const sd = sdr.body || {};
    check('T4 both sides can raise a defect', odr.status === 201 && sdr.status === 201,
      `office HTTP ${odr.status}${odr.status !== 201 ? ' ' + JSON.stringify(odr.body).slice(0, 120) : ''}, ship HTTP ${sdr.status}${sdr.status !== 201 ? ' ' + JSON.stringify(sdr.body).slice(0, 120) : ''}`);
    if (odr.status !== 201 || sdr.status !== 201) throw new Error('cannot continue the defect checks without both defects');
    const s4 = await sync();
    const both = `SELECT id, duuid FROM defects WHERE duuid IN (${sq(od.duuid)}, ${sq(sd.duuid)}) ORDER BY id`;
    const onShore = await shore(both);
    const onShip = ship(both + ';');
    check('T4 office number uses the office series, ship number the ship series', /^D\d{3}-\d{2}-O\d{4,}$/.test(od.id) && /^D\d{3}-\d{2}-\d{4,}$/.test(sd.id), `office ${od.id}, ship ${sd.id}`);
    check('T4 both defects present on BOTH sides with their own identity', onShore.length === 2 && onShip.length === 2, `shore ${onShore.length}, ship ${onShip.length}`);
    const seqLogsAfter = Number((await shore(`SELECT count(*) FROM sync_field_log WHERE table_name='defect_sequences'`))[0].count);
    const shipSeqLogs = Number(ship(`SELECT count(*) FROM sync_field_log WHERE table_name='defect_sequences' AND is_synced=false;`)[0][0]);
    check('T6 no defect counter changes logged for sync any more', seqLogsAfter === seqLogsBefore && shipSeqLogs === 0, `shore new logs ${seqLogsAfter - seqLogsBefore}, ship unsent ${shipSeqLogs}`);
    check('T4 sync without defect errors', !/defect/.test(String(s4.error || '')), s4.error || 'no errors');

    // T5 — FIXTURE: an old-style defect already holding the ship's NEXT number on shore (inserted directly, no field log).
    const nextShipNo = sd.id.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, '0'));
    const fixtureDuuid = (await shore(`SELECT gen_random_uuid()::text AS u`))[0].u;
    await shore(`INSERT INTO defects (id, duuid, vessel_id, vessel_name, issue_date, category, description, status, critical, is_coc, reported_by)
                 VALUES ($1, $2, $3, $4, $5, 'Defect', $6, 'Open', false, false, 'identity-fix-probe')`,
      [nextShipNo, fixtureDuuid, V, vName, new Date().toISOString().slice(0, 10), `FIXTURE old-style defect — ${TAG}`]);
    const clashing = (await api('ship', 'POST', '/defects', dBody('SHIP-2'))).body;
    const s5 = await sync();
    const fixtureNow = await shore(`SELECT id, duuid, description FROM defects WHERE id=$1`, [nextShipNo]);
    check('T5 fixture: ship took the number the shore already holds', clashing.id === nextShipNo, `ship ${clashing.id}`);
    check('T5 shore defect NOT overwritten (same identity, same text)', fixtureNow.length === 1 && fixtureNow[0].duuid === fixtureDuuid && /FIXTURE/.test(fixtureNow[0].description), `${fixtureNow[0]?.duuid === fixtureDuuid ? 'identity kept' : 'IDENTITY CHANGED'}`);
    const shipKept = ship(`SELECT count(*) FROM defects WHERE duuid=${sq(clashing.duuid)};`)[0][0];
    const shipPending = ship(`SELECT count(*) FROM sync_field_log WHERE row_uuid=${sq(clashing.duuid)} AND is_synced=false;`)[0][0];
    check('T5 ship defect kept and still pending (reported, not lost)', shipKept === '1' && Number(shipPending) > 0, `ship rows ${shipKept}, unsent logs ${shipPending}`);
    // The clash is detected on the SHORE (receiving the push). Push-side errors reach the ship only as a count, not
    // as text (pre-existing limitation, same for every dropped push row) — so the report is checked in the shore log.
    const shoreLog = process.env.SHORE_LOG || path.join(root, 'local-test-env/shore-syncfix.log');
    const logText = fs.existsSync(shoreLog) ? fs.readFileSync(shoreLog, 'utf8') : '';
    check('T5 clash reported on shore (log "NUMBER CLASH" for this defect)', logText.includes('NUMBER CLASH') && logText.includes(clashing.duuid),
      fs.existsSync(shoreLog) ? shoreLog : `shore log not found: ${shoreLog}`);
    check('T5 clash also shown on the ship\'s sync result ("Office could not apply")', /Office could not apply/.test(String(s5.error || '')) && String(s5.error || '').includes(clashing.duuid),
      String(s5.error || '(no error text)').slice(0, 140));
  } finally {
    for (const r of prevShore) await shore(`UPDATE approval_workflow_config SET level1_enabled=$1 WHERE function_id='pms-components-cr' AND variable_name=$2`, [r.level1_enabled, r.variable_name]);
    for (const [name, on] of prevShip) ship(`UPDATE approval_workflow_config SET level1_enabled=${on === 't'} WHERE function_id='pms-components-cr' AND variable_name=${sq(name)};`);
    await shoreDb.end();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASS'} (${results.length} checks)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

/**
 * Admin → Sync Vessels (06-Aug, Ghazi's design).
 *
 * WHY A BUTTON AND NOT A SWEEP: vessel work is rare (a vessel is added, or something looks
 * wrong) and it must be VISIBLE — the domain team needs to see what happened to each vessel,
 * not read a log. The old behaviour, pushing every active vessel on a timer, is what filled
 * the Shipskart tenant with data nobody asked for. This runs only when a human presses it.
 *
 * WHAT ONE RUN DOES, per active vessel:
 *   1. resolve-and-repair the link (pushVessel: adopt / repoint / resurrect / create)
 *   2. then flush the user↔vessel mappings that were waiting on that vessel
 * Step 2 is the half that fixes the symptom we chased all day: mappings sat at
 * 'awaiting_vessel' because the vessel was not linked yet, and nothing ever revisited them.
 *
 * PREVIEW MODE makes no writes and no create calls — it only reports what a run WOULD do,
 * including the conflict this integration cannot resolve on its own: our vessel name
 * matching a Shipskart vessel that carries a DIFFERENT IMO (the Gas Mia case — two records,
 * two IMOs, users split across them). Creating in that state is how the duplicate appeared,
 * so we surface it and let a human decide.
 */
import { getPool } from '../../../db';
import { pushVessel, findRemoteVesselByImo, settleAssignmentChanges } from './shipskartReconcilerService';
import * as b2bRepo from '../repositories/shipskartB2bRepository';
import { isShipInstance } from '../../sync/syncRole';

const PACE_MS = Math.max(0, Number(process.env.SHIPSKART_B2B_PACE_MS ?? 5000));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface VesselSyncRow {
  vesselId: string;
  name: string;
  imo: string | null;
  /** adopted | repointed | pushed | already_pushed | invalid_imo | lookup_failed | error |
   *  blocked_duplicate | name_conflict (preview only) | would_create / would_adopt (preview) */
  outcome: string;
  shipskartVesselId?: string | null;
  detail?: string | null;
  /** mappings settled for this vessel's users (run mode only) */
  mapped?: number;
  unmapped?: number;
}

export interface VesselSyncResult {
  preview: boolean;
  startedAt: string;
  finishedAt?: string;
  totals: Record<string, number>;
  rows: VesselSyncRow[];
  errors: string[];
}

let inFlight = false;
let lastRun: VesselSyncResult | null = null;
export function isVesselSyncRunning(): boolean { return inFlight; }
export function getLastVesselSync(): VesselSyncResult | null { return lastRun; }

async function activeVessels(): Promise<Array<{ vuuid: string; name: string; imoNumber: string | null; vesselType: string | null }>> {
  const pool = await getPool();
  if (!pool) throw Object.assign(new Error('Database not initialized'), { statusCode: 503 });
  const { rows } = await pool.query(
    `SELECT vuuid, name, imo_number AS "imoNumber", vessel_type AS "vesselType"
       FROM vessels WHERE is_active = true AND is_deleted = false ORDER BY name`,
  );
  return rows;
}

/** Users holding an assignment to this vessel that still needs mapping or unmapping. */
async function usersAwaitingOn(vesselVuuid: string): Promise<string[]> {
  const pool = await getPool();
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT user_uuid FROM master_user_vessels
      WHERE vessel_id = $1
        AND ( (is_active = true  AND map_status IN ('pending','awaiting_user','awaiting_vessel'))
           OR (is_active = false AND map_status = 'revoked' AND shipskart_mapping_id IS NOT NULL) )`,
    [vesselVuuid],
  );
  return rows.map((r: any) => r.user_uuid);
}

export async function runVesselSync(opts: { preview?: boolean } = {}): Promise<VesselSyncResult> {
  const preview = opts.preview === true;
  const res: VesselSyncResult = { preview, startedAt: new Date().toISOString(), totals: {}, rows: [], errors: [] };
  // Claim the flag BEFORE the first await. The handler answers 202 immediately and the page
  // refetches at once; if the flag were set after an await, that refetch would read
  // running:false, polling (which only starts while running) would never begin, and the page
  // would sit dead for the whole run — seen in browser testing 06-Aug.
  // PREVIEW COUNTS TOO (07-Aug): it is paced at 5s per vessel exactly like a real run, so on
  // a real fleet it outlasts any gateway timeout — the browser got a 504 while the work
  // carried on server-side. It is therefore a background job as well, and two of these must
  // never overlap on the same rate-limited API.
  if (inFlight) { res.errors.push('a vessel sync is already running'); return res; }
  inFlight = true;
  if (await isShipInstance()) {
    inFlight = false;
    res.errors.push('refused: Shipskart sync is shore-only');
    return res;
  }

  const tally = (k: string) => { res.totals[k] = (res.totals[k] || 0) + 1; };
  try {
    const vessels = await activeVessels();
    for (const v of vessels) {
      const row: VesselSyncRow = { vesselId: v.vuuid, name: v.name, imo: v.imoNumber, outcome: 'pending' };

      if (!v.imoNumber || !/^\d{7}$/.test(v.imoNumber)) {
        row.outcome = 'invalid_imo';
        row.detail = `IMO must be exactly 7 digits, got '${v.imoNumber ?? ''}' — fix it in the vessel record, it cannot be looked up or created`;
        res.rows.push(row); tally(row.outcome); continue;
      }

      if (preview) {
        // Read-only: one lookup, no writes, no creates.
        try {
          const remote = await findRemoteVesselByImo(v.imoNumber);
          const link = await b2bRepo.getVesselLink(v.vuuid);
          if (!remote) {
            row.outcome = 'would_create';
            row.detail = link?.shipskartVesselId ? `link holds ${link.shipskartVesselId} but that IMO is absent on Shipskart — it would be recreated` : null;
          } else if (link?.pushStatus === 'pushed' && link.shipskartVesselId === remote.id) {
            row.outcome = 'already_linked'; row.shipskartVesselId = remote.id;
          } else if (link?.shipskartVesselId && link.shipskartVesselId !== remote.id) {
            row.outcome = 'would_repoint'; row.shipskartVesselId = remote.id;
            row.detail = `stored ${link.shipskartVesselId} → ${remote.id}`;
          } else {
            row.outcome = 'would_adopt'; row.shipskartVesselId = remote.id;
          }
          if (remote && remote.name.trim().toLowerCase() !== v.name.trim().toLowerCase()) {
            row.detail = `${row.detail ? row.detail + ' · ' : ''}name differs on Shipskart: '${remote.name}'`;
          }
        } catch (err: any) {
          row.outcome = 'lookup_failed'; row.detail = String(err?.message || err).slice(0, 300);
        }
        res.rows.push(row); tally(row.outcome);
        await sleep(PACE_MS);
        continue;
      }

      // ── run ──
      const r = await pushVessel({ vuuid: v.vuuid, name: v.name, imoNumber: v.imoNumber, vesselType: v.vesselType });
      row.outcome = r.status;
      row.shipskartVesselId = r.shipskartId ?? null;
      if (r.error) row.detail = String(r.error).slice(0, 300);
      if (r.status === 'lookup_failed' || r.status === 'error') res.errors.push(`${v.name}: ${row.detail ?? r.status}`);
      await sleep(PACE_MS);

      // Flush the mappings that were waiting on this vessel.
      if (r.shipskartId) {
        row.mapped = 0; row.unmapped = 0;
        for (const userUuid of await usersAwaitingOn(v.vuuid)) {
          const s = await settleAssignmentChanges(userUuid);
          row.mapped += s.mapped; row.unmapped += s.unmapped;
          if (s.mapped || s.unmapped) await sleep(PACE_MS);
        }
      }
      res.rows.push(row); tally(row.outcome);
    }
  } catch (err: any) {
    res.errors.push(String(err?.message || err));
  } finally {
    inFlight = false;
    res.finishedAt = new Date().toISOString();
    lastRun = res;
    console.log(`[VesselSync] ${preview ? 'PREVIEW' : 'RUN'} finished: ${JSON.stringify(res.totals)} errors=${res.errors.length}`);
  }
  return res;
}

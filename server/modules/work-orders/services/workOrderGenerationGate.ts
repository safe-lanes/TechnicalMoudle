/**
 * WORK-ORDER GENERATION GATE — who may generate work orders directly, for which vessel.
 *
 * THE BUG THIS EXISTS TO STOP (proven on the pilot 2026-07-31, see
 * docs/WO-DUPLICATE-GENERATION-FIX-PLAN.md):
 *
 * Work orders have two possible writers — the ship's daily scanner and the office's
 * "Generate Now" — and BOTH the duplicate check (`jobDueScanner`, `storage.getWorkOrders`)
 * and the running number (`generatePlannedWorkOrderNumber`) are computed from the caller's
 * OWN database. When the office is missing the ship's work order (the dead-letter sync gap),
 * it sees nothing for that job, generates one, and numbers it max+1 over an empty set —
 * reproducing a number the ship already used. Sync then delivers it down and the vessel holds
 * two work orders for one job. Gas Mia: 189 duplicate numbers across three office bursts.
 *
 * ⚠️ REDUCED 2026-08-03 (Sahil's dual-writer design, plan §9). Shore now generates BY
 * DESIGN — its own daily scheduler runs regardless of ship state, and a post-sync
 * reconciler resolves the resulting duplicates (plan §9.2–9.6). The LIVE and CHECK_ME
 * refusals were therefore REMOVED: duplicate prevention is no longer this gate's job.
 * What remains is the part that was never about duplicates — this endpoint previously had
 * NO server-side gate at all:
 *
 *   ship instance     → ALLOW. The ship's own scanner does exactly this daily.
 *   shore + unknown/unresolvable vessel
 *                     → REFUSE (fail closed — absence of evidence is not a vessel).
 *   shore + role ≠ Sail Admin
 *                     → REFUSE. Generation is an admin action, not a general one.
 *   shore + Sail Admin + known vessel
 *                     → ALLOW, for ANY provisioning verdict — the reconciler owns
 *                       de-duplication now. Do NOT re-add a LIVE refusal here; it would
 *                       break the availability requirement the dual-writer design serves.
 *
 * ⚠️ THE ROLE HALF IS NOT ENFORCEMENT TODAY, AND CANNOT BE. `req.user.role` is hardcoded to
 * 'Sail Admin' by the RBAC mock (middleware/auth.ts), and the client forwards only x-user-id —
 * never x-user-role — so the real role never reaches the server. This module reads
 * `forwardedRole` first so it becomes real automatically the day real auth lands, but until
 * then the role check passes for everyone. That is acceptable ONLY because the protection
 * that actually stops the bug is the vessel-state half, which is a server-side database fact
 * and cannot be spoofed by a caller. Do not "simplify" this by deleting the role check.
 */
import * as syncService from '../../sync/service';
import type { VesselProvisioningState } from '../../sync/service';

/** The role permitted to generate directly on shore — the role that provisions. */
const PROVISIONING_ROLE = 'Sail Admin';

export type GateRefusalCode =
  | 'ROLE_NOT_PERMITTED'
  | 'VESSEL_STATE_UNKNOWN'
  | 'OFFICE_GENERATION_DISABLED';

export interface GateDecision {
  allowed: boolean;
  code?: GateRefusalCode;
  message?: string;
  /** Null when the caller is a ship (vessel state is irrelevant there) or on lookup failure. */
  state: VesselProvisioningState | null;
}

/** The real role if the client ever forwards it, else the mock. See the header warning. */
export function resolveGateRole(user: any): string {
  return (user?.forwardedRole || user?.role || '').trim();
}

/**
 * Per-vessel office generation kill switch (migration 161). Default OFF for every
 * vessel — the office may generate WOs for a vessel ONLY after Sail Admin explicitly
 * enables it. Fail closed: no settings row, NULL, or a query error all mean DISABLED.
 * This is a DB fact (like the vessel-state half) — it cannot be spoofed by a caller.
 * Ship instances never consult this (their own scanner is always the correct writer).
 */
export async function isOfficeWoGenerationEnabled(vesselId: string): Promise<boolean> {
  try {
    const { getPool } = await import('../../../db');
    const pool = await getPool();
    const r = await pool.query(
      `SELECT office_wo_generation_enabled AS enabled
         FROM pms_vessel_settings
        WHERE vessel_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
        LIMIT 1`,
      [vesselId],
    );
    return r.rows[0]?.enabled === true;
  } catch (err: any) {
    console.error(`[WO-Gate] office-generation switch lookup failed for vessel ${vesselId}: ${err?.message || err} — treating as DISABLED`);
    return false;
  }
}

export async function evaluateDirectGeneration(opts: {
  vesselId: string;
  role: string;
  isShip: boolean;
}): Promise<GateDecision> {
  // A ship generating into its own database is the normal, correct path — one writer.
  if (opts.isShip) return { allowed: true, state: null };

  let state: VesselProvisioningState;
  try {
    state = await syncService.getVesselProvisioningState(opts.vesselId);
  } catch (err: any) {
    // Fail closed — an unreadable state is not permission.
    return {
      allowed: false,
      code: 'VESSEL_STATE_UNKNOWN',
      message:
        'Could not determine whether this vessel has a ship provisioned, so work-order ' +
        'generation was refused. Try again; if it persists, raise it with support.',
      state: null,
    };
  }

  // REDUCED gate (plan §9.5): the verdict no longer refuses anything — shore generation on a
  // LIVE vessel is the dual-writer design working as intended, and the post-sync reconciler
  // owns de-duplication. The state is still resolved (and returned) because the vessel-exists
  // fail-closed check lives inside it, and callers log the verdict as telemetry.
  if (opts.role !== PROVISIONING_ROLE) {
    return {
      allowed: false,
      code: 'ROLE_NOT_PERMITTED',
      message: `Only a ${PROVISIONING_ROLE} may generate work orders directly from the office.`,
      state,
    };
  }

  // Per-vessel kill switch (migration 161): office generation is opt-in per vessel,
  // default OFF. This covers EVERY shore generation entry point that goes through the
  // gate (Generate Now, the shore sweep, per-job manual generation, admin scan).
  if (!(await isOfficeWoGenerationEnabled(opts.vesselId))) {
    return {
      allowed: false,
      code: 'OFFICE_GENERATION_DISABLED',
      message:
        'Office work-order generation is not enabled for this vessel. A Sail Admin can ' +
        'enable it per vessel on the Lead Time & Grace Period Settings screen.',
      state,
    };
  }

  return { allowed: true, state };
}

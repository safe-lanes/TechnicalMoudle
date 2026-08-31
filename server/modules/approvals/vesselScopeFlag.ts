/**
 * APPROVAL_VESSEL_SCOPE_STRICT — the rollout off-ramp for vessel-scoped approvals.
 *
 * ON (default): every role — office AND ship — is scoped to the subject's vessel via the
 * user's SAILERP-assigned vessel list (master_user_vessels). Out of scope → read-only.
 * OFF: legacy behaviour — office roles resolve fleet-wide, and the client gates treat an
 * empty assignment list as global access. Flip to off to roll back instantly with no deploy.
 *
 * Default ON; only the explicit strings 'false' / '0' / 'off' / 'no' disable it.
 */
export function isVesselScopeStrict(): boolean {
  const v = (process.env.APPROVAL_VESSEL_SCOPE_STRICT ?? "").trim().toLowerCase();
  return !(v === "false" || v === "0" || v === "off" || v === "no");
}

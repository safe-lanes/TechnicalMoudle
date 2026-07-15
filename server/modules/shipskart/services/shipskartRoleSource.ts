/**
 * Shipskart role source — THE single seam for the list of available Shipskart roles.
 *
 * Today it returns the static three (per Shipskart's UAT: captain / purchaser / manager).
 * When Shipskart's **Get Role API** ships, this function becomes a per-tenant API call
 * (cached as appropriate) — and NOTHING else changes: the only consumers are
 *   1. the PUT /shipskart/role-mappings validation, and
 *   2. the GET /shipskart/role-mappings response (the admin UI dropdown).
 * No other code may hardcode or re-derive this list.
 *
 * Async by design so the API swap is a drop-in.
 */
export async function getAvailableShipskartRoles(): Promise<string[]> {
  // FUTURE (Shipskart Get Role API): fetch per tenant, e.g.
  //   return (await signedGet('/api/v1/roles')).roles.map(r => r.name);
  return ['captain', 'purchaser', 'manager'];
}

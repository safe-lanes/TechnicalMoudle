/**
 * Shipskart role source — THE single seam for the list of available Shipskart roles.
 *
 * NOW LIVE (Stage 2, 2026-07-30): fetches the tenant's real roles from the b2b
 * get-all-roles endpoint (paginated, pageSize 100), cached for ROLE_CACHE_TTL_MS.
 * Consumers are unchanged: (1) PUT /shipskart/role-mappings validation and (2) the
 * admin UI dropdown. No other code may hardcode or re-derive this list.
 *
 * LIVE ROLES ONLY (2026-07-31). The legacy static three ('captain'/'purchaser'/'manager')
 * are NO LONGER offered: they existed for the shared per-role account bridge, which is
 * retired. Offering them now would be actively harmful — a role mapped to a legacy name
 * has no live roleId, so create-user records 'unmapped_role' and the user is BLOCKED from
 * Purchasing with a confusing reason. The dropdown must only ever offer names the tenant
 * actually has. (WK's live roles: WAH-KWONG-PUCHASER / WAH-KWONG-CAPTAIN — no manager.)
 *
 * FAIL-SAFE, in order: live fetch → last-known-good cache (stale OK) → empty list. An empty
 * list is the honest answer when Shipskart is unreachable and nothing was ever cached: the
 * admin sees no options rather than options that silently fail.
 *
 * Also exports resolveShipskartRoleId(name) for the reconciler's create-user call —
 * roleId is authoritative on Shipskart's side (roleName proven cosmetic, 2026-07-30).
 */
import { authorizedB2bRequest } from './shipskartTokenService';

const ROLE_CACHE_TTL_MS = 10 * 60 * 1000;

interface ShipskartRole { id: string; name: string; isActive?: boolean }

let cache: { roles: ShipskartRole[]; fetchedAt: number } | null = null;

async function fetchAllRolesLive(): Promise<ShipskartRole[]> {
  const all: ShipskartRole[] = [];
  let page = 1;
  // pageSize max 100 per their validation; totalPages from the first response.
  for (;;) {
    const res = await authorizedB2bRequest('GET', `/integration/SAIL/get-all-roles?pageNumber=${page}&pageSize=100`);
    if (!res.ok || !Array.isArray(res.json?.items)) {
      throw new Error(`[Shipskart b2b] get-all-roles page ${page} failed (${res.status}): ${JSON.stringify(res.json ?? res.text)?.slice(0, 200)}`);
    }
    all.push(...res.json.items.filter((r: any) => r?.isActive !== false));
    const totalPages = Number(res.json.totalPages ?? 1);
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

async function getRoles(): Promise<ShipskartRole[]> {
  if (cache && Date.now() - cache.fetchedAt < ROLE_CACHE_TTL_MS) return cache.roles;
  try {
    const roles = await fetchAllRolesLive();
    cache = { roles, fetchedAt: Date.now() };
    return roles;
  } catch (err: any) {
    // Fail-safe: stale cache beats an empty dropdown; the static legacy list beats both being absent.
    console.warn(`[Shipskart b2b] role fetch failed — serving ${cache ? 'last-known-good cache' : 'an EMPTY list (nothing cached yet; the mapping dropdown will be empty until Shipskart is reachable)'}: ${err?.message || err}`);
    if (cache) return cache.roles;
    return [];
  }
}

/** Role NAMES for the mapping UI/validation — the tenant's LIVE roles, nothing else. */
export async function getAvailableShipskartRoles(): Promise<string[]> {
  return Array.from(new Set((await getRoles()).map((r) => r.name)));
}

/**
 * Live roleId for a role name (exact match). Returns null for any name the tenant does not
 * have — including legacy names left in old mapping rows, which the reconciler then records
 * as 'unmapped_role' rather than guessing a substitute.
 */
export async function resolveShipskartRoleId(roleName: string): Promise<string | null> {
  const roles = await getRoles();
  return roles.find((r) => r.name === roleName)?.id ?? null;
}

/** Test hook: drop the cache (harness only). */
export function _clearRoleCache(): void { cache = null; }

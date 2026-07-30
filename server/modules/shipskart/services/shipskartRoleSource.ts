/**
 * Shipskart role source — THE single seam for the list of available Shipskart roles.
 *
 * NOW LIVE (Stage 2, 2026-07-30): fetches the tenant's real roles from the b2b
 * get-all-roles endpoint (paginated, pageSize 100), cached for ROLE_CACHE_TTL_MS.
 * Consumers are unchanged: (1) PUT /shipskart/role-mappings validation and (2) the
 * admin UI dropdown. No other code may hardcode or re-derive this list.
 *
 * FAIL-SAFE, in order: live fetch → last-known-good cache (stale OK) → the LEGACY static
 * three. The legacy names ('captain'/'purchaser'/'manager') are ALWAYS included in the
 * returned list, because existing mapping rows store them and the live SSO env bridge
 * (accountForShipskartRole) resolves ONLY them — an admin's saved mapping must never
 * become invalid because this list changed. (Proven on UAT: the WK tenant's live roles
 * are WAH-KWONG-PUCHASER / WAH-KWONG-CAPTAIN — there is NO manager role there.)
 *
 * Also exports resolveShipskartRoleId(name) for the reconciler's create-user call —
 * roleId is authoritative on Shipskart's side (roleName proven cosmetic, 2026-07-30).
 */
import { authorizedB2bRequest } from './shipskartTokenService';

const ROLE_CACHE_TTL_MS = 10 * 60 * 1000;

/** Legacy static names — permanently valid for mapping rows + the SSO env bridge. */
const LEGACY_ROLES = ['captain', 'purchaser', 'manager'];

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
    console.warn(`[Shipskart b2b] role fetch failed — serving ${cache ? 'last-known-good cache' : 'legacy static list'}: ${err?.message || err}`);
    if (cache) return cache.roles;
    return [];
  }
}

/** Role NAMES for the mapping UI/validation: live tenant roles ∪ legacy three. */
export async function getAvailableShipskartRoles(): Promise<string[]> {
  const live = (await getRoles()).map((r) => r.name);
  return Array.from(new Set([...live, ...LEGACY_ROLES]));
}

/**
 * Live roleId for a role name (exact match). Returns null for unknown names —
 * including the legacy three when the tenant has no such live role (the reconciler
 * treats that as 'unmapped_role', never guesses).
 */
export async function resolveShipskartRoleId(roleName: string): Promise<string | null> {
  const roles = await getRoles();
  return roles.find((r) => r.name === roleName)?.id ?? null;
}

/** Test hook: drop the cache (harness only). */
export function _clearRoleCache(): void { cache = null; }

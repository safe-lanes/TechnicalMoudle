/**
 * Shipskart role-mapping admin endpoints (browser routes — tenantMiddleware scopes them to
 * the logged-in tenant's DB, so mappings are per-tenant with no extra plumbing).
 *
 * GET  /shipskart/role-mappings — current mappings + the available Shipskart roles
 *                                 (from the single role-source seam; the UI dropdown must
 *                                 use THIS list, never a hardcoded one).
 * PUT  /shipskart/role-mappings — bulk upsert/unmap. shipskartRole values are validated
 *                                 against the same seam. Unmapping (null) blocks that SAIL
 *                                 role's SSO with the existing ROLE_NOT_MAPPED behaviour
 *                                 (block-not-default by design).
 *
 * Guard: Sail Admin / Super Admin. NOTE (parked): the backend runs mock auth today —
 * req.user.role is always 'Sail Admin', so this check is real enforcement only once real
 * auth lands; until then the UI's hasRole gate is the effective control (same caveat as
 * every admin endpoint in this codebase).
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import * as repo from '../repositories/shipskartRoleMappingRepository';
import { getAvailableShipskartRoles } from '../services/shipskartRoleSource';

const EDITOR_ROLES = new Set(['Sail Admin', 'Super Admin']);

export async function getRoleMappingsHandler(req: AuthenticatedRequest, res: Response) {
  const [availableRoles, rows] = await Promise.all([
    getAvailableShipskartRoles(),
    repo.getAllMappings(),
  ]);
  // A saved mapping can point at a role the tenant does NOT have — e.g. rows written
  // before the dropdown became live-only, which named the retired shared-account roles
  // ('captain'/'purchaser'/'manager'). Such a mapping silently BLOCKS its users
  // ('unmapped_role' at create-user), so flag it here instead of letting an admin find out
  // when someone cannot open Purchasing. `stale: true` = this row needs remapping.
  const live = new Set(availableRoles);
  const mappings = rows.map(r => ({
    sailRole: r.sailRole,
    shipskartRole: r.shipskartRole,
    stale: !live.has(r.shipskartRole),
  }));
  const staleCount = mappings.filter(m => m.stale).length;
  if (staleCount > 0) {
    console.warn(
      `[Shipskart] ${staleCount} role mapping(s) point at a Shipskart role this tenant does not have ` +
      `(${mappings.filter(m => m.stale).map(m => `${m.sailRole}→${m.shipskartRole}`).join(', ')}) — ` +
      `users on those SAIL roles are BLOCKED from Purchasing until they are remapped.`,
    );
  }
  res.json({ availableRoles, mappings, staleCount });
}

export async function putRoleMappingsHandler(req: AuthenticatedRequest, res: Response) {
  const userRole = req.user?.role || '';
  if (!EDITOR_ROLES.has(userRole)) {
    return res.status(403).json({ error: 'forbidden', message: 'Only Sail Admin / Super Admin may edit the Shipskart role mapping.' });
  }
  const mappings = req.body?.mappings;
  if (!Array.isArray(mappings)) {
    return res.status(400).json({ error: 'mappings[] is required' });
  }

  const validRoles = new Set(await getAvailableShipskartRoles());
  // Validate everything BEFORE writing anything (no partial saves).
  for (const m of mappings) {
    if (!m || typeof m.sailRole !== 'string' || !m.sailRole.trim()) {
      return res.status(400).json({ error: `every entry needs a sailRole` });
    }
    if (m.shipskartRole != null && !validRoles.has(m.shipskartRole)) {
      return res.status(400).json({
        error: 'invalid_shipskart_role',
        message: `'${m.shipskartRole}' is not an available Shipskart role (${Array.from(validRoles).join(', ')}).`,
      });
    }
  }

  const updatedBy = req.user?.userUuid || null;
  for (const m of mappings) {
    if (m.shipskartRole == null) {
      await repo.deleteMapping(m.sailRole.trim());
    } else {
      await repo.upsertMapping(m.sailRole.trim(), m.shipskartRole, updatedBy);
    }
  }

  const rows = await repo.getAllMappings();
  res.json({
    success: true,
    mappings: rows.map(r => ({ sailRole: r.sailRole, shipskartRole: r.shipskartRole })),
  });
}

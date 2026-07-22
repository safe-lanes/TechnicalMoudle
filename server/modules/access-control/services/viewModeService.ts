/**
 * View-mode service — business rules for the configurable role→view-mode
 * mapping (Task #324).
 *
 * Core policy:
 *   • FAIL CLOSED: an unmapped/unknown role resolves to mode=null with a
 *     machine-readable reason. The frontend blocks entry — no default-open
 *     fallthrough to a permissive mode.
 *   • HARDCODED BYPASS: Office/'Sail Admin' always resolves to Sail_Admin
 *     regardless of DB state, so a bad edit can never lock out the only role
 *     that can fix the mapping. The Sail Admin row is also rejected on save.
 *   • Editing is SHORE-ONLY (enforced in controller); ships receive rows via sync.
 */
import * as repo from '../repositories/viewModeRepository';
import type { RoleWithMapping } from '../repositories/viewModeRepository';
import type { ViewModesMaster } from '@shared/schema';

export const SAIL_ADMIN_ROLE = 'Sail Admin';
export const SAIL_ADMIN_MODE = 'Sail_Admin';

export interface MappingEntry {
  roleRuid: string;
  viewModeCode: string | null; // null = unmap (soft delete)
}

export interface ResolveResult {
  mode: string | null;
  reason: 'ROLE_NOT_FOUND' | 'ROLE_NOT_MAPPED' | null;
}

export async function listViewModes(): Promise<ViewModesMaster[]> {
  return repo.getActiveViewModes();
}

export async function getRoleViewMappings(): Promise<{
  availableModes: ViewModesMaster[];
  mappings: RoleWithMapping[];
}> {
  const [availableModes, mappings] = await Promise.all([
    repo.getActiveViewModes(),
    repo.getRolesWithMappings(),
  ]);
  return { availableModes, mappings };
}

export class ValidationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Validate ALL entries before writing ANY (no partial saves). */
export async function saveMappings(
  entries: MappingEntry[],
  updatedByUuid: string | null,
): Promise<void> {
  const activeCodes = new Set((await repo.getActiveViewModes()).map((m) => m.code));

  const validated: Array<{ entry: MappingEntry; roleName: string; roletype: string }> = [];
  for (const entry of entries) {
    if (!entry || typeof entry.roleRuid !== 'string' || !entry.roleRuid.trim()) {
      throw new ValidationError('invalid_entry', 'Every entry needs a roleRuid.');
    }
    if (entry.viewModeCode != null && !activeCodes.has(entry.viewModeCode)) {
      throw new ValidationError(
        'invalid_view_mode',
        `'${entry.viewModeCode}' is not an active view mode.`,
      );
    }
    const role = await repo.getActiveRoleByRuid(entry.roleRuid.trim());
    if (!role) {
      throw new ValidationError('role_not_found', `No active role with ruid '${entry.roleRuid}'.`);
    }
    if (role.roletype === 'Office' && role.assignedRole === SAIL_ADMIN_ROLE) {
      throw new ValidationError(
        'sail_admin_locked',
        'The Sail Admin role mapping is locked and cannot be changed.',
      );
    }
    validated.push({ entry: { ...entry, roleRuid: entry.roleRuid.trim() }, roleName: role.assignedRole, roletype: role.roletype });
  }

  for (const { entry } of validated) {
    if (entry.viewModeCode == null) {
      await repo.softDeleteMapping(entry.roleRuid, updatedByUuid);
    } else {
      await repo.upsertMapping(entry.roleRuid, entry.viewModeCode, updatedByUuid);
    }
  }
}

/**
 * Resolve the view mode for a login (userType = admn_role_master.roletype,
 * roleName = assigned_role). Fail-closed with the Sail Admin bypass.
 */
export async function resolveViewMode(
  userType: string,
  roleName: string,
): Promise<ResolveResult> {
  // Hardcoded bypass — must work even with an empty/corrupt DB mapping.
  if (userType === 'Office' && roleName === SAIL_ADMIN_ROLE) {
    return { mode: SAIL_ADMIN_MODE, reason: null };
  }

  const role = await repo.getActiveRoleByTypeAndName(userType, roleName);
  if (!role) {
    return { mode: null, reason: 'ROLE_NOT_FOUND' };
  }

  const mapping = await repo.getMappingByRoleRuid(role.ruid);
  if (!mapping) {
    return { mode: null, reason: 'ROLE_NOT_MAPPED' };
  }

  // Mode must still be active + non-deleted — a retired mode fails closed too.
  const activeCodes = new Set((await repo.getActiveViewModes()).map((m) => m.code));
  if (!activeCodes.has(mapping.viewModeCode)) {
    return { mode: null, reason: 'ROLE_NOT_MAPPED' };
  }

  return { mode: mapping.viewModeCode, reason: null };
}

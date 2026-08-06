/**
 * requirePermission(resource, action) — shared CRUD permission guard (Task: enforce
 * access control across ungated modules).
 *
 * Backed by adm_role_menu_access (same data the frontend PermissionsContext reads),
 * so Access Control edits take effect immediately (per-request lookup, no process cache).
 *
 * Policy — mirrors client/src/contexts/PermissionsContext.tsx exactly:
 *   • Role resolved SERVER-SIDE from the authenticated request (req.user.role, set by
 *     the session/auth middleware) — never from client-supplied role ruids or headers.
 *   • HARDCODED BYPASS: 'Sail Admin' (and 'PMS Admin', which the existing
 *     requirePMSAdmin middleware treats as an admin peer) always pass, so admins with
 *     missing/stale permission rows are never locked out. Parity with the frontend's
 *     admin flows and viewModeService's Sail Admin bypass.
 *   • UNCONFIGURED = FAIL-OPEN: a role with no row in admn_role_master, or with ZERO
 *     adm_role_menu_access rows, is allowed through (the frontend shows everything for
 *     such roles today; the "missing permissions" task owns changing that policy).
 *   • CONFIGURED = FAIL-CLOSED: once permission rows exist, the matching
 *     can_create/can_edit/can_delete flag must be true; a missing menu row or missing
 *     permission row denies (403), exactly like the frontend's canCreate/canEdit/canDelete.
 */
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";
import { storage } from "../storage";

export type PermissionAction = "create" | "edit" | "delete";

const BYPASS_ROLES = new Set(["Sail Admin", "PMS Admin"]);

const ACTION_FLAG: Record<PermissionAction, "canCreate" | "canEdit" | "canDelete"> = {
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
};

interface PermState {
  status: "unconfigured" | "configured";
  /** menu name -> muid (only when configured) */
  menuByName: Map<string, string>;
  /** muid -> permission row (only when configured) */
  permsByMuid: Map<string, { canCreate?: boolean; canEdit?: boolean; canDelete?: boolean }>;
}

const REQ_CACHE_KEY = "__permGuardState";

/** Resolve + cache the caller's permission state for the lifetime of this request only. */
async function getPermState(req: AuthenticatedRequest): Promise<PermState> {
  const cached = (req as any)[REQ_CACHE_KEY] as PermState | undefined;
  if (cached) return cached;

  let state: PermState;
  const roleName = req.user?.role ?? "";
  const role = roleName ? await storage.getRoleByName(roleName) : null;
  if (!role) {
    // Unknown role name — mirrors the frontend's 404 → "unconfigured" fail-open path.
    state = { status: "unconfigured", menuByName: new Map(), permsByMuid: new Map() };
  } else {
    const rows = await storage.getRoleMenuPermissions((role as any).ruid);
    if (!rows || rows.length === 0) {
      state = { status: "unconfigured", menuByName: new Map(), permsByMuid: new Map() };
    } else {
      const menuItems = await storage.getActiveMenuItems();
      const menuByName = new Map<string, string>();
      for (const m of menuItems as any[]) menuByName.set(m.name, m.muid);
      const permsByMuid = new Map<string, any>();
      for (const p of rows as any[]) permsByMuid.set(p.menuMuid, p);
      state = { status: "configured", menuByName, permsByMuid };
    }
  }
  (req as any)[REQ_CACHE_KEY] = state;
  return state;
}

/**
 * Express middleware factory. `action` may be a single action or an array
 * (array = any-of, for bulk save endpoints that both insert and update).
 */
export function requirePermission(
  resource: string,
  action: PermissionAction | PermissionAction[],
) {
  const actions = Array.isArray(action) ? action : [action];
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized - Authentication required" });
      }
      if (BYPASS_ROLES.has(req.user.role)) return next();

      const state = await getPermState(req);
      if (state.status === "unconfigured") return next(); // fail-open parity with frontend

      const muid = state.menuByName.get(resource);
      const perm = muid ? state.permsByMuid.get(muid) : undefined;
      const allowed = !!perm && actions.some((a) => (perm as any)[ACTION_FLAG[a]] === true);
      if (!allowed) {
        return res.status(403).json({
          error: "Forbidden - Insufficient permissions",
          resource,
          action: actions.join("|"),
        });
      }
      next();
    } catch (err: any) {
      // Explicit failure — do not silently allow or deny on infrastructure errors.
      res.status(500).json({ error: "Permission check failed", details: err?.message });
    }
  };
}

import { Router, Request, Response } from 'express';
import { storage } from '../../storage';
import { requirePMSAdmin } from '../../middleware/auth';

const router = Router();

router.get('/admin/roles', async (_req: Request, res: Response) => {
  try {
    const roles = await storage.getActiveRoles();
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch roles', details: error.message });
  }
});

router.get('/admin/menu-items', async (_req: Request, res: Response) => {
  try {
    const menuItems = await storage.getActiveMenuItems();
    res.json(menuItems);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

router.get('/admin/role-by-name/:roleName', async (req: Request, res: Response) => {
  try {
    const { roleName } = req.params;
    const role = await storage.getRoleByName(roleName);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(role);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch role', details: error.message });
  }
});

router.get('/admin/access-control/:roleRuid', async (req: Request, res: Response) => {
  try {
    const { roleRuid } = req.params;
    const permissions = await storage.getRoleMenuPermissions(roleRuid);

    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch permissions', details: error.message });
  }
});

router.put('/admin/access-control/:roleRuid', requirePMSAdmin, async (req: Request, res: Response) => {
  try {
    const { roleRuid } = req.params;
    const { permissions } = req.body as {
      permissions: Array<{
        menuMuid: string;
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
      }>;
    };

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    // Audit Phase 2 — capture the BEFORE grants prior to the wipe-and-replace save.
    const normGrant = (p: any) => ({
      menuMuid: p.menuMuid,
      canView: p.canView ?? false,
      canCreate: p.canCreate ?? false,
      canEdit: p.canEdit ?? false,
      canDelete: p.canDelete ?? false,
    });
    let beforeGrants: any[] = [];
    try {
      beforeGrants = (await storage.getRoleMenuPermissions(roleRuid)).map(normGrant);
    } catch { /* best-effort — never block the save */ }

    const result = await storage.saveRoleMenuPermissions(roleRuid, permissions);

    // Audit Phase 2 — role→menu permission change. Subject = the ROLE (PMS RBAC is role-based;
    // there is no per-user access state). Actor (who) is frozen by createAuditLog (Phase 0).
    // Records full before + after grant arrays AND a concise per-menu diff. No secrets exist here.
    try {
      const afterGrants = permissions.map(normGrant);
      const beforeByMenu: Record<string, any> = {};
      beforeGrants.forEach((g) => { beforeByMenu[g.menuMuid] = g; });
      const afterByMenu: Record<string, any> = {};
      afterGrants.forEach((g) => { afterByMenu[g.menuMuid] = g; });
      const flags = ['canView', 'canCreate', 'canEdit', 'canDelete'] as const;
      const changedMenus: Array<{ menuMuid: string; from: any; to: any }> = [];
      const allMenuKeys = Object.keys({ ...beforeByMenu, ...afterByMenu });
      for (const menuMuid of allMenuKeys) {
        const from = beforeByMenu[menuMuid] ?? null;
        const to = afterByMenu[menuMuid] ?? null;
        const differs = !from || !to || flags.some((f) => from[f] !== to[f]);
        if (differs) changedMenus.push({ menuMuid, from, to });
      }
      let roleName: string | null = null;
      try {
        const roles = await storage.getActiveRoles();
        const role = roles.find((r: any) => r.ruid === roleRuid);
        roleName = (role as any)?.assignedRole ?? (role as any)?.roleName ?? (role as any)?.name ?? null;
      } catch { /* roleName is best-effort */ }

      await storage.createAuditLog({
        entityType: 'role_permission',
        entityId: roleRuid,
        actionType: 'permission_change',
        source: 'web_ui',
        vesselCode: null,
        componentCode: null,
        payload: {
          subject: { roleRuid, roleName },
          before: beforeGrants,
          after: afterGrants,
          changedMenus,
          changedCount: changedMenus.length,
        },
      });
    } catch (auditErr: any) {
      console.error('[Audit] role permission change log failed:', auditErr?.message);
    }

    res.json({ success: true, count: result.count });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save permissions', details: error.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { admnRoleMaster, admMenumasterAc, admRoleMenuAccess } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const router = Router();

router.get('/admin/roles', async (_req: Request, res: Response) => {
  try {
    const roles = await db
      .select()
      .from(admnRoleMaster)
      .where(eq(admnRoleMaster.isActive, true))
      .orderBy(asc(admnRoleMaster.sortOrder));
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch roles', details: error.message });
  }
});

router.get('/admin/menu-items', async (_req: Request, res: Response) => {
  try {
    const menuItems = await db
      .select()
      .from(admMenumasterAc)
      .where(eq(admMenumasterAc.isActive, true))
      .orderBy(asc(admMenumasterAc.sortOrder));
    res.json(menuItems);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

router.get('/admin/access-control/:roleRuid', async (req: Request, res: Response) => {
  try {
    const { roleRuid } = req.params;
    const permissions = await db
      .select()
      .from(admRoleMenuAccess)
      .where(eq(admRoleMenuAccess.roleRuid, roleRuid));
    res.json(permissions);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch permissions', details: error.message });
  }
});

router.put('/admin/access-control/:roleRuid', async (req: Request, res: Response) => {
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

    await db.transaction(async (tx) => {
      await tx.delete(admRoleMenuAccess).where(eq(admRoleMenuAccess.roleRuid, roleRuid));

      if (permissions.length > 0) {
        const rows = permissions.map((p) => ({
          roleRuid,
          menuMuid: p.menuMuid,
          canView: p.canView ?? false,
          canCreate: p.canCreate ?? false,
          canEdit: p.canEdit ?? false,
          canDelete: p.canDelete ?? false,
          updatedAt: new Date(),
        }));
        await tx.insert(admRoleMenuAccess).values(rows);
      }
    });

    res.json({ success: true, count: permissions.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save permissions', details: error.message });
  }
});

export default router;

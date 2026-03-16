import { Router, Request, Response } from 'express';
import { storage } from '../../storage';

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

    const result = await storage.saveRoleMenuPermissions(roleRuid, permissions);
    res.json({ success: true, count: result.count });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save permissions', details: error.message });
  }
});

export default router;

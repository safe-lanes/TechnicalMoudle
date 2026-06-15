-- Fix-up: Grant Admin role full CRUD on stores sub-menu items
-- Admin role should have write access matching Sail Admin/Super Admin

UPDATE adm_role_menu_access
SET can_create = true, can_edit = true, can_delete = true, updated_at = NOW()
WHERE role_ruid = (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Admin' LIMIT 1)
  AND menu_muid IN (
    SELECT muid FROM adm_menumaster_ac WHERE name IN ('pms-stores-stores', 'pms-stores-lubes', 'pms-stores-chemicals', 'pms-stores-others')
  );

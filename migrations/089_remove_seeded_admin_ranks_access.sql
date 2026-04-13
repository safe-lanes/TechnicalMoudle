-- Corrective migration: Remove all role-menu-access records seeded for
-- the admin-ranks menu item. This single record was flipping every role
-- from "unconfigured" (allow all) to "configured" (deny all except Ranks).
--
-- Role permissions should NEVER be seeded by migrations — they are
-- configured manually by a Sail Admin through the Access Control UI.

DELETE FROM adm_role_menu_access
WHERE menu_muid IN (
  SELECT muid FROM adm_menumaster_ac
  WHERE name = 'admin-ranks'
);

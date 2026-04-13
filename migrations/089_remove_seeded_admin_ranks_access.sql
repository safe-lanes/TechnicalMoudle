-- Corrective migration: Remove all role-menu-access records for admin-ranks
-- menu item that were seeded (not manually configured through the UI).
--
-- The admin-ranks menu entry had permission records for nearly every role,
-- flipping them from "unconfigured" (allow all) to "configured" (deny all
-- except explicitly granted), causing Access Denied.
--
-- Role permissions should NEVER be seeded — only configured manually
-- by a Sail Admin through the Access Control UI.

DELETE FROM adm_role_menu_access
WHERE menu_muid IN (
  SELECT muid FROM adm_menumaster_ac
  WHERE name = 'admin-ranks'
);

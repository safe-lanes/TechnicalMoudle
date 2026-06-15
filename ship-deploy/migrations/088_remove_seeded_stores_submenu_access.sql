-- Corrective migration: Remove all role-menu-access records seeded by
-- migrations 085 and 086 for the 4 stores sub-menu items.
--
-- Role permissions should NEVER be seeded by migrations — they are
-- configured manually by a Sail Admin through the Access Control UI.
-- Migration 085 accidentally inserted records for ALL active roles,
-- which flipped the PermissionsContext from "unconfigured = allow all"
-- to "configured = deny everything not explicitly granted."

DELETE FROM adm_role_menu_access
WHERE menu_muid IN (
  SELECT muid FROM adm_menumaster_ac
  WHERE name IN (
    'pms-stores-stores',
    'pms-stores-lubes',
    'pms-stores-chemicals',
    'pms-stores-others'
  )
);

-- Migration 105: Seed permissions for all menu items across key roles
-- Fixes: migration 104 activated RBAC but only sync pages had grants,
-- causing all other modules (PMS, Defects, Cert & Surveys) to disappear.
--
-- PORTABLE: Uses name-based lookups only — no hardcoded UUIDs.

-- ============================================================
-- Full CRUD access for admin-tier roles
-- ============================================================
-- Roles: Sail Admin, Super Admin, Admin, Offline Admin

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM admn_role_master r
CROSS JOIN adm_menumaster_ac m
WHERE r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
  AND r.is_deleted = false
  AND m.is_deleted = false
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- ============================================================
-- View-only access for vessel-tier roles
-- ============================================================
-- Roles: Vessel User, Vessel Admin

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, false, false
FROM admn_role_master r
CROSS JOIN adm_menumaster_ac m
WHERE r.assigned_role IN ('Vessel User', 'Vessel Admin')
  AND r.is_deleted = false
  AND m.is_deleted = false
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

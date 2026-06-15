-- Migration 104: Register sync admin pages in the RBAC permission system
-- Adds 3 menu items (Sync Dashboard, Ship Provisioning, Fleet Overview)
-- and grants access to Sail Admin, Offline Admin, Super Admin, Admin, and Vessel Admin roles
--
-- PORTABLE: All parent menu and role references use name-based lookups,
-- not hardcoded UUIDs. This migration works on any database environment.

-- ============================================================
-- STEP 1: Insert sync menu items under the "admin" parent
-- ============================================================

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order)
VALUES
  (31, gen_random_uuid(), 'admin-sync-dashboard', 'Sync Dashboard', '/admin/sync-dashboard',
    (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1), true, 27),
  (32, gen_random_uuid(), 'admin-sync-provisioning', 'Ship Provisioning', '/admin/sync-provisioning',
    (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1), true, 28),
  (33, gen_random_uuid(), 'admin-sync-fleet', 'Fleet Overview', '/admin/sync-fleet',
    (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1), true, 29)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- STEP 2: Grant access to admin roles
-- ============================================================

-- Grant all 3 sync pages to Sail Admin (full access)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Sail Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant all 3 sync pages to Super Admin (full access)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Super Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant all 3 sync pages to Admin (full access)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant all 3 sync pages to Offline Admin (full access — needed for ship-side sync operations)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Offline Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant Sync Dashboard + Ship Provisioning to Vessel Admin (view + edit, no fleet overview)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Vessel Admin' LIMIT 1), muid, true, false, true, false
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

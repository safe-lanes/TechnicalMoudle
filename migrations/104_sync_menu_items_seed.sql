-- Migration 104: Register sync admin pages in the RBAC permission system
-- Adds 3 menu items (Sync Dashboard, Ship Provisioning, Fleet Overview)
-- and grants access to Sail Admin, Offline Admin, Super Admin, and Admin roles

-- ============================================================
-- STEP 1: Insert sync menu items under the "admin" parent
-- ============================================================
-- Admin parent muid: a8a0783b-2347-4753-8643-0544e48124df
-- Existing admin items use sort_order 22-26, so we use 27-29

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order)
VALUES
  (31, gen_random_uuid(), 'admin-sync-dashboard', 'Sync Dashboard', '/admin/sync-dashboard', 'a8a0783b-2347-4753-8643-0544e48124df', true, 27),
  (32, gen_random_uuid(), 'admin-sync-provisioning', 'Ship Provisioning', '/admin/sync-provisioning', 'a8a0783b-2347-4753-8643-0544e48124df', true, 28),
  (33, gen_random_uuid(), 'admin-sync-fleet', 'Fleet Overview', '/admin/sync-fleet', 'a8a0783b-2347-4753-8643-0544e48124df', true, 29)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- STEP 2: Grant access to admin roles
-- ============================================================
-- Roles that need sync page access:
--   Sail Admin:    a167f0bf-abd0-4412-888a-3b8789035f4c
--   Super Admin:   c66b5ff4-85ca-48d7-930b-75e205b8160f
--   Admin:         28893a97-e475-4e19-afc5-d17f1b9adbb6
--   Offline Admin: 02e56c7f-8e75-43ec-8105-839e312aeb2e
--   Vessel Admin:  c064869d-ec04-4633-8076-e9e6043f1f47

-- Grant all 3 sync pages to Sail Admin (full access)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT 'a167f0bf-abd0-4412-888a-3b8789035f4c', muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant all 3 sync pages to Super Admin (full access)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT 'c66b5ff4-85ca-48d7-930b-75e205b8160f', muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant all 3 sync pages to Admin (full access)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT '28893a97-e475-4e19-afc5-d17f1b9adbb6', muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant all 3 sync pages to Offline Admin (full access — needed for ship-side sync operations)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT '02e56c7f-8e75-43ec-8105-839e312aeb2e', muid, true, true, true, true
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Grant Sync Dashboard + Ship Provisioning to Vessel Admin (view + edit, no fleet overview)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT 'c064869d-ec04-4633-8076-e9e6043f1f47', muid, true, false, true, false
FROM adm_menumaster_ac WHERE name IN ('admin-sync-dashboard', 'admin-sync-provisioning')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

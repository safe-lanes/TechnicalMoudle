-- Migration 108: Register the Approval Workflow admin page in the RBAC permission system
-- Adds 1 menu item (Approval Workflow) under the "admin" parent
-- and grants access to Sail Admin, Super Admin, Admin, Offline Admin, and Vessel Admin roles.
--
-- PORTABLE: All parent menu and role references use name-based lookups,
-- not hardcoded UUIDs. This migration works on any database environment.

-- ============================================================
-- STEP 1: Insert the Approval Workflow menu item under "admin"
-- ============================================================

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order)
VALUES
  (34, gen_random_uuid(), 'admin-approval-workflow', 'Approval Workflow', '/admin/approval-workflow',
    (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1), true, 30)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- STEP 2: Grant access to admin roles
-- ============================================================

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Sail Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Super Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Offline Admin' LIMIT 1), muid, true, true, true, true
FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT (SELECT ruid FROM admn_role_master WHERE assigned_role = 'Vessel Admin' LIMIT 1), muid, true, false, true, false
FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

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
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-approval-workflow', 'Approval Workflow', '/admin/approval-workflow',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1), true, 30
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- ============================================================
-- STEP 2: Grant access to admin roles
-- ============================================================

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'admin-approval-workflow'
  AND r.assigned_role = 'Sail Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'admin-approval-workflow'
  AND r.assigned_role = 'Super Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'admin-approval-workflow'
  AND r.assigned_role = 'Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'admin-approval-workflow'
  AND r.assigned_role = 'Offline Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, true, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'admin-approval-workflow'
  AND r.assigned_role = 'Vessel Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

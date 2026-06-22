-- Migration 130: Register Purchasing and Approval Workflow submodules in RBAC
--
-- Adds 3 menu items:
--   1. purchasing             — top-level, embeds Shipskart iframe (read-only by design)
--   2. approval-workflow-pms  — child of admin-approval-workflow
--   3. approval-workflow-defects — child of admin-approval-workflow
--
-- PORTABLE: All role and parent references use name-based lookups.
-- IDEMPOTENT: Each INSERT uses WHERE NOT EXISTS (name) guard.

-- ============================================================
-- STEP 1: Insert menu items
-- ============================================================

-- 1a. purchasing (top-level, no parent)
INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'purchasing', 'Purchasing', '/purchasing',
  NULL, true, 60, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'purchasing');

-- 1b. approval-workflow-pms (child of admin-approval-workflow)
INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'approval-workflow-pms', 'PMS', NULL,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow' LIMIT 1),
  true, 10, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'approval-workflow-pms')
  AND EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- 1c. approval-workflow-defects (child of admin-approval-workflow)
INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'approval-workflow-defects', 'Defects', NULL,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow' LIMIT 1),
  true, 20, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'approval-workflow-defects')
  AND EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- ============================================================
-- STEP 2: Purchasing permissions
-- Read-only for all office/admin roles (can_view only; write flags always false)
-- Vessel roles get no access (purchasing is an office-only module)
-- ============================================================

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'purchasing'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- ============================================================
-- STEP 3: Approval Workflow › PMS permissions
-- Office/Admin roles: can_view + can_edit (configure approval chains)
-- Vessel roles: can_view only (submit requests, read-only on config)
-- ============================================================

-- Admin-tier: view + edit
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, true, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-pms'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Vessel-tier: view only
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-pms'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Vessel User', 'Vessel Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- ============================================================
-- STEP 4: Approval Workflow › Defects permissions
-- Same pattern as PMS submodule
-- ============================================================

-- Admin-tier: view + edit
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, true, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-defects'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Vessel-tier: view only
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-defects'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Vessel User', 'Vessel Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

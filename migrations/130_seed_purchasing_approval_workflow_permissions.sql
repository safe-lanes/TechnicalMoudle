-- Migration 130: Register Approval Workflow submodules in RBAC
--
-- Adds 3 menu items (idempotent — WHERE NOT EXISTS guards throughout):
--   1. admin-approval-workflow  — parent menu under 'admin' (guard for envs missing migration 108)
--   2. approval-workflow-pms    — child of admin-approval-workflow
--   3. approval-workflow-defects — child of admin-approval-workflow
--
-- Note: Purchasing is NOT in the RBAC system — it is always visible to all logged-in users.
-- If purchasing rows exist from a prior run, migration 132 removes them.
--
-- Seeds role-menu access rows:
--   Approval (PMS)  : admin-tier can_view+can_edit; vessel-tier can_view+can_create (submit capability)
--   Approval (Defects): same pattern as PMS
--
-- PORTABLE  : All lookups use name/assigned_role — no hardcoded UUIDs or IDs.
-- IDEMPOTENT: Menu INSERTs use WHERE NOT EXISTS; permission INSERTs use ON CONFLICT DO NOTHING.

-- ============================================================
-- STEP 1: Ensure admin-approval-workflow parent exists
-- Migration 108 should have created this, but we guard here so
-- child inserts below always have a valid parent to reference.
-- ============================================================

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-approval-workflow', 'Approval Workflow', '/admin/approval-workflow',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 30, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- ============================================================
-- STEP 2: Insert approval-workflow-pms (child of admin-approval-workflow)
-- ============================================================

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'approval-workflow-pms', 'PMS', NULL,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow' LIMIT 1),
  true, 10, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'approval-workflow-pms')
  AND EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- ============================================================
-- STEP 3: Insert approval-workflow-defects (child of admin-approval-workflow)
-- ============================================================

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'approval-workflow-defects', 'Defects', NULL,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow' LIMIT 1),
  true, 20, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'approval-workflow-defects')
  AND EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- ============================================================
-- STEP 4: Approval Workflow › PMS permissions
-- Admin-tier : can_view + can_edit (configure approval chains)
-- Vessel-tier: can_view + can_create (submit PMS approval requests)
-- ============================================================

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, true, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-pms'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-pms'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Vessel User', 'Vessel Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- ============================================================
-- STEP 5: Approval Workflow › Defects permissions (same pattern as PMS)
-- Admin-tier : can_view + can_edit
-- Vessel-tier: can_view + can_create (submit defect approval requests)
-- ============================================================

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, true, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-defects'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'approval-workflow-defects'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Vessel User', 'Vessel Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Migration 131: Fix & complement migration 130
--
-- Addresses three issues found in 130:
--   1. Ensure admin-approval-workflow parent exists before child inserts
--      (environments where migration 108 was missed would have had orphaned children)
--   2. Correct vessel-tier can_create for approval-workflow-pms/defects:
--      ship/vessel roles need can_create=true (submit capability)
--   3. Seed Purchasing permission rows for ALL roles (vessel roles: can_view=false,
--      all write flags false) so every role has a configurable row in Access Control
--
-- PORTABLE: Name-based lookups only, no hardcoded UUIDs.
-- IDEMPOTENT: INSERT uses WHERE NOT EXISTS; UPDATE uses explicit SET.

-- ============================================================
-- STEP 1: Ensure the Approval Workflow parent menu item exists
-- (Migration 108 should have done this, but we guard here for
--  environments where it may have been missed.)
-- ============================================================

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-approval-workflow', 'Approval Workflow', '/admin/approval-workflow',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 30, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- ============================================================
-- STEP 2: Ensure approval-workflow-pms and approval-workflow-defects
-- exist (in case they were skipped in 130 due to missing parent)
-- ============================================================

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'approval-workflow-pms', 'PMS', NULL,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow' LIMIT 1),
  true, 10, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'approval-workflow-pms')
  AND EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'approval-workflow-defects', 'Defects', NULL,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow' LIMIT 1),
  true, 20, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'approval-workflow-defects')
  AND EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-approval-workflow');

-- ============================================================
-- STEP 3: Ensure admin-tier has access to both submodules
-- (safe no-op if 130 already seeded these rows)
-- ============================================================

INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, true, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name IN ('approval-workflow-pms', 'approval-workflow-defects')
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- ============================================================
-- STEP 4: Fix vessel-tier can_create for approval submodules
-- Ship/vessel roles should be able to submit requests (can_create=true).
-- Migration 130 incorrectly seeded can_create=false for these roles.
-- UPDATE existing rows; INSERT missing ones.
-- ============================================================

-- Update existing rows seeded by 130 with wrong can_create value
UPDATE adm_role_menu_access
SET can_create = true
FROM adm_menumaster_ac m, admn_role_master r
WHERE adm_role_menu_access.menu_muid = m.muid
  AND adm_role_menu_access.role_ruid = r.ruid
  AND m.name IN ('approval-workflow-pms', 'approval-workflow-defects')
  AND r.assigned_role IN ('Vessel User', 'Vessel Admin')
  AND adm_role_menu_access.can_create = false;

-- Insert missing vessel rows (for environments where 130 left them out)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name IN ('approval-workflow-pms', 'approval-workflow-defects')
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Vessel User', 'Vessel Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- ============================================================
-- STEP 5: Seed Purchasing permission rows for ALL active roles
-- Admin-tier: can_view=true, all write flags false (already done by 130 for admin)
-- Vessel-tier: can_view=false, all write flags false (new in this migration)
-- Every role gets a row so Access Control shows it as configurable.
-- ============================================================

-- Admin-tier (idempotent — 130 may have inserted these already)
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'purchasing'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Vessel-tier: view=false by default (office module), write always false
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, false, false, false, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'purchasing'
  AND m.is_deleted = false
  AND r.is_deleted = false
  AND r.assigned_role IN ('Vessel User', 'Vessel Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

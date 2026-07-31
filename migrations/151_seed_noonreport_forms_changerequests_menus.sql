-- Migration 151: Seed adm_menumaster_ac resource rows for Noon Report, Forms,
-- and Change Requests so they become configurable in Admin > Access Control
-- (Task: enforce CRUD access control across ungated modules).
--
-- Idempotent by NAME on both ship and shore (adm_menumaster_ac participates in
-- ship<->shore sync): INSERT ... SELECT WHERE NOT EXISTS (name), parent looked
-- up by name, no hardcoded ids, muid via gen_random_uuid(). Follows the
-- portable pattern of migration 117 (one insert at a time so MAX(id)+1 sees
-- the previous insert).

-- 1. noon-report (top-level module)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'noon-report', 'Noon Report', '/noon-report',
  NULL,
  true, 60, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'noon-report');

-- 2. admin-forms (parent: admin) — Forms configuration admin
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-forms', 'Forms', '/admin/forms',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 61, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-forms');

-- 3. change-requests (parent: pms — change requests live in the Modify PMS flow)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'change-requests', 'Change Requests', NULL,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms' LIMIT 1),
  true, 62, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'change-requests');

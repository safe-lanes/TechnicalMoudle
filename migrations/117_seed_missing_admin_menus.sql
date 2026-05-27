-- Migration 117: Seed admin/pms-stores menu rows missing on some databases
-- due to id-collision bugs in earlier migrations (067, 078, 085, 104) where
-- ON CONFLICT (id) DO NOTHING silently skipped inserts when the hardcoded id
-- was already taken. Uses portable INSERT...SELECT WHERE NOT EXISTS (name)
-- so it is idempotent on every DB. Parent menus looked up by name, not id.

-- ============================================================
-- STEP 1: Insert the 9 missing menu rows (one at a time so
--         each MAX(id)+1 sees the previous insert)
-- ============================================================

-- 1. admin-access-control (parent: admin)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-access-control', 'Access Control', '/admin/access-control',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 25, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-access-control');

-- 2. admin-ranks (parent: admin)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-ranks', 'Ranks', '/admin/ranks',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 26, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-ranks');

-- 3. pms-stores-stores (parent: pms-stores)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'pms-stores-stores', 'Stores', '/stores?tab=stores',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1),
  true, 101, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'pms-stores-stores');

-- 4. pms-stores-lubes (parent: pms-stores)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'pms-stores-lubes', 'Lubes', '/stores?tab=lubes',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1),
  true, 102, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'pms-stores-lubes');

-- 5. pms-stores-chemicals (parent: pms-stores)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'pms-stores-chemicals', 'Chemicals', '/stores?tab=chemicals',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1),
  true, 103, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'pms-stores-chemicals');

-- 6. pms-stores-others (parent: pms-stores)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'pms-stores-others', 'Others', '/stores?tab=others',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1),
  true, 104, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'pms-stores-others');

-- 7. admin-sync-dashboard (parent: admin)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-sync-dashboard', 'Sync Dashboard', '/admin/sync-dashboard',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 27, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-sync-dashboard');

-- 8. admin-sync-provisioning (parent: admin)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-sync-provisioning', 'Ship Provisioning', '/admin/sync-provisioning',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 28, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-sync-provisioning');

-- 9. admin-sync-fleet (parent: admin)
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-sync-fleet', 'Fleet Overview', '/admin/sync-fleet',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 29, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-sync-fleet');

-- ============================================================
-- STEP 2: Grant CRUD permissions for the 9 menus to admin
--         roles using CROSS JOIN (tolerant of missing roles)
-- ============================================================
-- Full CRUD: Sail Admin, Super Admin, Admin, Offline Admin
-- View+Edit only: Vessel Admin

-- Sail Admin — full CRUD all 9
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name IN ('admin-access-control', 'admin-ranks', 'pms-stores-stores', 'pms-stores-lubes', 'pms-stores-chemicals', 'pms-stores-others', 'admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
  AND r.assigned_role = 'Sail Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Super Admin — full CRUD all 9
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name IN ('admin-access-control', 'admin-ranks', 'pms-stores-stores', 'pms-stores-lubes', 'pms-stores-chemicals', 'pms-stores-others', 'admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
  AND r.assigned_role = 'Super Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Admin — full CRUD all 9
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name IN ('admin-access-control', 'admin-ranks', 'pms-stores-stores', 'pms-stores-lubes', 'pms-stores-chemicals', 'pms-stores-others', 'admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
  AND r.assigned_role = 'Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Offline Admin — full CRUD all 9
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name IN ('admin-access-control', 'admin-ranks', 'pms-stores-stores', 'pms-stores-lubes', 'pms-stores-chemicals', 'pms-stores-others', 'admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
  AND r.assigned_role = 'Offline Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Vessel Admin — view + edit only, no create/delete
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, false, true, false
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name IN ('admin-access-control', 'admin-ranks', 'pms-stores-stores', 'pms-stores-lubes', 'pms-stores-chemicals', 'pms-stores-others', 'admin-sync-dashboard', 'admin-sync-provisioning', 'admin-sync-fleet')
  AND r.assigned_role = 'Vessel Admin'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

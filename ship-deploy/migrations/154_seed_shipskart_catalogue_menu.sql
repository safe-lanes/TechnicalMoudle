-- 154: seed the Admin → Shipskart Catalogue menu into the RBAC menu master.
-- The sidebar item (commit 50e13be16) is permission-filtered like every admin menu:
-- without this row canViewSidebarItem() finds no menu named 'admin-shipskart-catalogue'
-- and hides the item for EVERY role — which is exactly what the domain team hit on dev.
-- Same pattern as mig 117 (admin-sync-fleet): name-based lookups, no hardcoded ids,
-- idempotent (second run = clean no-op).

-- 1. Menu row (parent: admin). sort_order 31 — after admin-approval-workflow (30).
INSERT INTO adm_menumaster_ac
  (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
SELECT
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  gen_random_uuid(), 'admin-shipskart-catalogue', 'Shipskart Catalogue', '/admin/shipskart-catalogue',
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin' LIMIT 1),
  true, 31, NOW(), NOW(), false, false
WHERE NOT EXISTS (SELECT 1 FROM adm_menumaster_ac WHERE name = 'admin-shipskart-catalogue');

-- 2. Permissions: full CRUD for the office admin roles (shore-only feature — ship roles
--    never see the menu; more roles can be granted later via Access Control).
INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT r.ruid, m.muid, true, true, true, true
FROM adm_menumaster_ac m
CROSS JOIN admn_role_master r
WHERE m.name = 'admin-shipskart-catalogue'
  AND r.assigned_role IN ('Sail Admin', 'Super Admin', 'Admin', 'Offline Admin')
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- Migration 112: Sync Conflict Review — menu item, RBAC grants, alert policy
--
-- Adds:
--   1. Menu item for "Conflict Review" page
--   2. RBAC grants mirroring existing sync-dashboard
--   3. Alert policy for sync_conflict_detected notifications
--
-- All lookups use name-based identifiers (not hardcoded integer ids)
-- to stay robust across environments.

-- ═══════════════════════════════════════════════════════
-- 1. Menu item
-- ═══════════════════════════════════════════════════════
-- id has no sequence — compute from current max.
-- ON CONFLICT (name) ensures idempotency.

INSERT INTO adm_menumaster_ac (id, name, display_name, route, sort_order, is_active)
VALUES (
  (SELECT COALESCE(MAX(id), 0) + 1 FROM adm_menumaster_ac),
  'admin-sync-conflicts',
  'Conflict Review',
  '/admin/sync-conflicts',
  (SELECT COALESCE(MAX(sort_order), 0) + 1
   FROM adm_menumaster_ac WHERE name LIKE 'admin-sync%'),
  true
)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 2. RBAC grants — copy from sync-dashboard
-- ═══════════════════════════════════════════════════════
-- On dev environments adm_role_menu_access may be empty,
-- so this INSERT ... SELECT is a safe no-op when no source rows exist.

INSERT INTO adm_role_menu_access
  (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete)
SELECT
  rma.role_ruid,
  (SELECT muid FROM adm_menumaster_ac WHERE name = 'admin-sync-conflicts'),
  rma.can_view,
  rma.can_create,
  rma.can_edit,
  rma.can_delete
FROM adm_role_menu_access rma
JOIN adm_menumaster_ac m ON m.muid = rma.menu_muid
WHERE m.name = 'admin-sync-dashboard'
ON CONFLICT (role_ruid, menu_muid) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 3. Alert policy for sync conflict notifications
-- ═══════════════════════════════════════════════════════

INSERT INTO alert_policies (
  alert_type, enabled, priority,
  email_enabled, in_app_enabled,
  thresholds, scope_filters, recipients,
  created_by, updated_by, apuuid
)
VALUES (
  'sync_conflict_detected', true, 'medium',
  false, true,
  '{}', '{}',
  '{"roles": ["Ship", "Office", "PMS Admin", "Sail Admin", "Super Admin", "Vessel Admin"]}',
  'system', 'system', 'policy-sync-conflict-detected'
)
ON CONFLICT (apuuid) DO NOTHING;

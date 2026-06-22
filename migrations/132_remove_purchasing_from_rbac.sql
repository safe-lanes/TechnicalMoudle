-- Migration 132: Remove Purchasing from the RBAC permission system
--
-- Purchasing is reverting to an always-visible module (no role-based gate).
-- This migration cleans up the DB rows seeded by migration 130.
--
-- IDEMPOTENT: DELETE uses WHERE EXISTS guards — safe to re-run.

-- Step 1: Remove all role-permission rows for the purchasing menu item
DELETE FROM adm_role_menu_access
WHERE menu_muid IN (
  SELECT muid FROM adm_menumaster_ac WHERE name = 'purchasing'
);

-- Step 2: Remove the purchasing menu item itself
DELETE FROM adm_menumaster_ac
WHERE name = 'purchasing';

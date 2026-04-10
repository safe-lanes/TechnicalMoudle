-- ============================================================================
-- Migration 085: Master List Types table
-- ============================================================================
--
-- WHAT THIS DOES
--   Introduces a DB-backed registry of master list types with a Section
--   dimension (Components / Jobs/WO / Spares). Replaces the hardcoded
--   LIST_TYPES constant previously in client/src/pages/admin/MasterListsManagement.tsx.
--
--   Enables:
--     - Inline creation of new list types from the "Add New Master List Item"
--       popup (Sail Admin only).
--     - Section-based grouping of list types in the admin UI.
--     - Soft delete + rename protection (in-use check) via the service layer.
--
-- SECTION MAPPING DECISIONS (confirmed by domain team — Jeevan)
--   department          -> Components   (a department owns components)
--   componentCategory   -> Components
--   location            -> Components   (physical location of a component on the vessel)
--   rank                -> Jobs/WO      (job approvals / assignments tied to rank)
--   intervalUnit        -> Jobs/WO      (maintenance job interval units)
--   overdueReason       -> Jobs/WO
--   postponementReason  -> Jobs/WO
--
--   All seven are marked is_system=true and cannot be deleted or have their
--   key/section modified via the API. Only new SQL migrations can create or
--   alter system types.
--
-- IDEMPOTENCY
--   - CREATE TABLE IF NOT EXISTS  -> safe on re-run
--   - CREATE INDEX IF NOT EXISTS  -> safe on re-run
--   - ON CONFLICT (list_type_key) DO NOTHING on BOTH seed blocks, meaning:
--       * Re-running the migration never overwrites admin edits to seeded rows.
--       * Re-running the orphan auto-seed never re-creates a type that an
--         admin has already edited/reactivated/renamed via the UI.
--
-- ORPHAN AUTO-SEED
--   Any list_type value present in master_lists that has NO matching row in
--   master_list_types is captured as a non-system, inactive entry under the
--   Spares section on first run. Admins can later reassign its section,
--   relabel it, or reactivate it from the Manage List Types UI.
--
-- SYNC-READINESS
--   Sync-ready fields from day 1 per the Sync Readiness Addendum:
--     mltuuid, updated_at, created_by_uuid, updated_by_uuid, is_deleted, is_sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_list_types (
  id SERIAL PRIMARY KEY,
  mltuuid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  list_type_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('Components', 'Jobs/WO', 'Spares')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_uuid TEXT,
  updated_by_uuid TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  is_sync BOOLEAN NOT NULL DEFAULT false
);

-- Partial indexes for common filtered queries (exclude soft-deleted rows)
CREATE INDEX IF NOT EXISTS idx_mlt_section ON master_list_types(section) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_mlt_active  ON master_list_types(is_active) WHERE is_deleted = false;

-- ---------------------------------------------------------------------------
-- Seed the 7 existing hardcoded types from the legacy LIST_TYPES constant.
-- All marked is_system=true so they cannot be deleted or have their
-- key/section modified via the API.
--
-- Section mapping confirmed by domain team (Jeevan):
--   department          -> Components
--   componentCategory   -> Components
--   location            -> Components  (physical location on vessel)
--   rank                -> Jobs/WO
--   intervalUnit        -> Jobs/WO
--   overdueReason       -> Jobs/WO
--   postponementReason  -> Jobs/WO
-- ---------------------------------------------------------------------------
INSERT INTO master_list_types (list_type_key, label, section, is_system, display_order) VALUES
  ('department',         'Department',          'Components', true, 1),
  ('componentCategory',  'Component Category',  'Components', true, 2),
  ('location',           'Location',            'Components', true, 3),
  ('rank',               'Rank',                'Jobs/WO',    true, 1),
  ('intervalUnit',       'Interval Unit',       'Jobs/WO',    true, 2),
  ('overdueReason',      'Overdue Reason',      'Jobs/WO',    true, 3),
  ('postponementReason', 'Postponement Reason', 'Jobs/WO',    true, 4)
ON CONFLICT (list_type_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auto-detect any orphan list_type values in master_lists that are not
-- covered by the seeds above. These are legacy/unknown types that will be
-- created as inactive, non-system entries under Spares so an admin can
-- later reassign their section or reactivate them.
--
-- Idempotent via ON CONFLICT (list_type_key) DO NOTHING — if this runs a
-- second time after an admin has edited/reactivated the orphan, we do not
-- overwrite their changes.
-- ---------------------------------------------------------------------------
INSERT INTO master_list_types (list_type_key, label, section, is_system, is_active, display_order)
SELECT DISTINCT
  ml.list_type,
  ml.list_type,           -- use the raw key as the label; admins can rename later
  'Spares',
  false,
  false,                  -- inactive by default — admins must review + activate
  0
FROM master_lists ml
LEFT JOIN master_list_types mlt ON mlt.list_type_key = ml.list_type
WHERE mlt.id IS NULL
ON CONFLICT (list_type_key) DO NOTHING;

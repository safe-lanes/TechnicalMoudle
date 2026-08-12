-- Migration 164: assignment retry bookkeeping + role-mapping roleId (reconciler hardening)
--
-- NUMBERING: 163 taken by the fork's dual-completion work (Task #399); 144 remains
-- RESERVED for the Phase 1 tri-state. This is 164, verified free at HEAD 2026-08-11.
-- The defect_sequences composite-key fix (still awaiting sign-off) becomes 165.
--
-- WHY (both proven on production 11-Aug-2026):
--  1. QUEUE STARVATION: the hourly reconciler settles at most 25 assignment rows per pass,
--     selected with NO ordering. Rows that fail as awaiting_* stay in the selection set, so
--     the same stuck rows can occupy the head of the queue pass after pass while fresh rows
--     (the Gas Mia / Testvessel assignments Jeevan was waiting on) never get reached.
--  2. STRANDED TRANSIENT FAILURES: a mapping attempt that hits Shipskart's rate limiter is
--     recorded as map_status='error' — and NO retry path (click, Sync Vessels, hourly pass)
--     ever selects 'error'. gurpreet's Gas Mia row sat stranded exactly this way until a
--     manual SQL reset.
--
-- map_attempts / last_attempt_at mirror the sync_field_log retry ladder (migration 147):
-- LOCAL bookkeeping only — never on any wire, never synced (master_user_vessels is NO_SYNC).
ALTER TABLE master_user_vessels ADD COLUMN IF NOT EXISTS map_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE master_user_vessels ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- B1: store Shipskart's role GUID alongside the name. The id is what actually travels on
-- create-user (the name was only ever our storage key), so a Shipskart-side RENAME — the
-- exact WAH-KWONG-PUCHASER→PURCHASER outage of 07-Aug — no longer breaks resolution once a
-- row has been (re)saved. Nullable: legacy rows keep resolving by name until re-saved.
ALTER TABLE shipskart_role_mappings ADD COLUMN IF NOT EXISTS shipskart_role_id TEXT;

-- Oldest-attempt-first needs an index to stay cheap at fleet scale.
CREATE INDEX IF NOT EXISTS idx_muv_retry
  ON master_user_vessels (last_attempt_at NULLS FIRST, map_attempts)
  WHERE is_active = true AND map_status IN ('pending','awaiting_user','awaiting_vessel','error');

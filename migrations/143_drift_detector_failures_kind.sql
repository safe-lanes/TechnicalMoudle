-- Migration 143: extend sync_field_log_failures into the single operator surface for
-- sync-integrity findings, so the drift detector reports alongside the Phase-0
-- un-swallow "lost log" records instead of in a second place nobody watches.
--
-- WHY A DRIFT DETECTOR (Frontier Venture, group A / the "39"):
--   39 work_orders rows carried the values of an 8-Jul completion save for every field
--   whose log old_value was NULL, but kept their PRE-save values for the only three
--   fields that had a prior value (status / approval_tier / days_late). The row therefore
--   disagreed with its OWN newest field log for 16 days and nothing noticed. A daily
--   row-vs-own-newest-log comparison would have surfaced all 39 on 9-Jul.
--
-- SCOPE (stated so expectations are right): this detects LOCAL drift only — a row's value
-- against that row's own newest log, on ONE instance. It catches the CAUSE class. It does
-- NOT compare ship against shore, so a divergence where both sides are internally
-- consistent but disagree with each other is invisible to it. Cross-instance
-- reconciliation is Phase 3.
--
-- kind values: 'field_log_lost' (mig 142, the logger's own failure record)
--              'drift'          (this detector: row value != its own newest log)
--
-- LOCAL BOOKKEEPING ONLY: like mig 142, deliberately NOT in shared/syncConfig.ts (never
-- synced) and never exported by provisioning.
-- Idempotent: IF NOT EXISTS / IF EXISTS throughout; second run is a clean no-op.

ALTER TABLE sync_field_log_failures
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'field_log_lost';
--> statement-breakpoint

-- The drifting field, and a payload holding expected/actual/log timestamp for the operator.
-- NB: no CHECK constraint on kind — house rule, and it keeps future kinds additive.
ALTER TABLE sync_field_log_failures
  ADD COLUMN IF NOT EXISTS field_name text;
--> statement-breakpoint

ALTER TABLE sync_field_log_failures
  ADD COLUMN IF NOT EXISTS details jsonb;
--> statement-breakpoint

-- Last time a scan re-observed this same unresolved finding (dedupe target below).
ALTER TABLE sync_field_log_failures
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
--> statement-breakpoint

-- DEDUPE: a daily scan re-observes persistent drift every run. Without this the table
-- grows by N rows per day per finding and the operator list becomes unreadable. One
-- unresolved row per (kind, table, row, field); repeat observations bump last_seen_at.
-- Partial index so RESOLVED history is retained in full.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sflf_open_finding
  ON sync_field_log_failures (kind, table_name, row_uuid, COALESCE(field_name, ''))
  WHERE resolved = false;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_sflf_kind_open
  ON sync_field_log_failures (kind, resolved, occurred_at);
--> statement-breakpoint

-- Backfill: rows written by mig 142's logger path predate `kind` and are all lost-log
-- records. The column default already covers them; this is belt-and-braces for any row
-- inserted with an explicit NULL before the NOT NULL default landed.
UPDATE sync_field_log_failures SET kind = 'field_log_lost' WHERE kind IS NULL;

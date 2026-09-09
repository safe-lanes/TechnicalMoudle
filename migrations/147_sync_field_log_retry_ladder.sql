-- Migration 147: persist per-record delivery attempts so retries survive a restart, and index
-- the retry predicate.
--
-- NUMBERING: 143 drift, 144 RESERVED for Phase 1 tri-state (do not take it), 145 deprecate,
-- 146 boolean normalise. This is 147.
--
-- WHY (Frontier Venture, the "71"): the ship counted consecutive delivery failures in an
-- IN-MEMORY Map (syncEngine.ts droppedRetryCount) and, after DEAD_LETTER_AFTER=3, force-marked
-- the row is_synced=true to "stop the loop" — silently declaring undelivered data delivered.
-- That is the loss path. The counter is now a column, the dead-letter force-mark is DELETED, and
-- a backoff ladder (1h/6h/24h/3d/7d, then every 7d forever) throttles retries instead of giving
-- up. Nothing is ever abandoned.
--
-- NO BACKFILL, and it is provably safe:
--   * existing rows get sync_attempts=0, last_attempt_at=NULL;
--   * every gather predicate leads with is_synced=false, so these columns are never read for
--     already-synced rows;
--   * an unsynced row with last_attempt_at=NULL is immediately eligible — i.e. exactly today's
--     behaviour on the first cycle after deploy.
--
-- LOCAL BOOKKEEPING ONLY: the sync wire payload is built explicitly in syncEngine.pushData
-- (tableName/rowUuid/fieldName/oldValue/newValue/vesselId/changedAt/changedByUserId/instanceId).
-- These two columns are not on it and never travel. Same category as migrations 142 and 143.
--
-- Idempotent: IF NOT EXISTS throughout; a second run is a clean no-op.

ALTER TABLE sync_field_log
  ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0;
--> statement-breakpoint

ALTER TABLE sync_field_log
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
--> statement-breakpoint

-- PARTIAL index — the ladder predicate is only ever evaluated for undelivered rows, and those are
-- normally a tiny slice of the table. Without this the added
-- "last_attempt_at IS NULL OR last_attempt_at < now() - <interval>" clause degrades the gather to
-- an index scan on (instance_id, is_synced) followed by a heap filter over the whole backlog.
CREATE INDEX IF NOT EXISTS idx_sfl_retry
  ON sync_field_log (instance_id, vessel_id, last_attempt_at)
  WHERE is_synced = false;

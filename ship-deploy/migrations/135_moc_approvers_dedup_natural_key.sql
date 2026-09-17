-- 135: moc_approvers duplicate cleanup + natural-key uniqueness.
--
-- The Sync-All "Sync Approvers" step was a soft-delete-then-blind-insert with a fresh
-- mauuid per run and NO natural key — duplicates stacked (manual + synced copies,
-- swallowed-cleanup stacking) and tombstone ghosts accumulated. This migration:
--   (1) TOMBSTONES duplicates — keeps the NEWEST active row per natural key
--       (user_id, approver_level, modulename) and soft-deletes the rest, stamping
--       updated_at=NOW() so the ONE_WAY mirror delivers the eviction to every vessel.
--       Deliberately NO hard purge: a hard-deleted row never gathers again, so any
--       vessel that missed the tombstone would keep a stale-active copy forever.
--   (2) Adds a partial UNIQUE index on the natural key over ACTIVE rows so the DB can
--       recognise an existing approver (the rewritten Sync-All upserts against it).
--
-- Idempotent: run 2 finds no duplicates (0 rows) and the index already exists.
-- Rows with NULL user_id or NULL approver_level cannot be keyed — they are left
-- untouched by the dedup and, being NULL, never collide in the unique index either
-- (the writer skips key-less approvers, so synced rows always carry both).

UPDATE moc_approvers m
SET is_deleted = true, updated_at = NOW()
WHERE m.is_deleted = false
  AND m.user_id IS NOT NULL
  AND m.approver_level IS NOT NULL
  AND m.id NOT IN (
    SELECT DISTINCT ON (user_id, approver_level, modulename) id
    FROM moc_approvers
    WHERE is_deleted = false AND user_id IS NOT NULL AND approver_level IS NOT NULL
    ORDER BY user_id, approver_level, modulename, updated_at DESC, id DESC
  );
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS moc_approvers_natural_key_active
ON moc_approvers (user_id, approver_level, modulename)
WHERE is_deleted = false;

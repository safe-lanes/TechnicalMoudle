-- 151: work_order_reconcile_archive — shore-side bookkeeping for the WO duplicate
-- reconciler (docs/WO-DUPLICATE-GENERATION-FIX-PLAN.md §9.3).
--
-- NO_SYNC by omission: this table is deliberately NOT in shared/syncConfig.ts (same
-- pattern as the Shipskart link tables, mig 149). It never travels; the ship converges
-- via the field-logged soft-delete/repoints the reconciler performs on the live tables.
--
-- The jsonb snapshot preserves the losing work order exactly as archived, even if the
-- soft-deleted row is later mutated or pruned. loser_wouuid is UNIQUE so a re-run can
-- never archive the same row twice (idempotency backstop).
--
-- Idempotent: IF NOT EXISTS everywhere; second run is a clean no-op.

CREATE TABLE IF NOT EXISTS work_order_reconcile_archive (
  archive_uuid       text PRIMARY KEY,
  vessel_id          text NOT NULL,
  work_order_no      text NOT NULL,
  loser_wouuid       text NOT NULL UNIQUE,
  survivor_wouuid    text NOT NULL,
  resolution_case    integer NOT NULL,          -- 1 = one-touched, 2 = neither-touched, 3 = both-touched
  loser_row_snapshot jsonb NOT NULL,
  child_moves        jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes              text,
  reconciled_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wora_vessel   ON work_order_reconcile_archive (vessel_id);
CREATE INDEX IF NOT EXISTS idx_wora_wo_no    ON work_order_reconcile_archive (work_order_no);
CREATE INDEX IF NOT EXISTS idx_wora_survivor ON work_order_reconcile_archive (survivor_wouuid);

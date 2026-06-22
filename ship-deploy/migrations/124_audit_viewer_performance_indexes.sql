-- Migration 124: Audit Phase 3 viewer — performance indexes (ADDITIVE ONLY)
-- The unified Audit Trail viewer sorts each source by recency (ORDER BY <date> DESC LIMIT n).
-- Two sources had no index on their sort column, forcing a Seq Scan + Sort that scales with table
-- size — worst on running_hours_audit (life-of-equipment, never pruned → unbounded). These indexes
-- turn that into an Index Scan (no sort): proven ~25x on the RH page query at 60k rows, and constant-
-- time per page as the tables grow.
--
-- Purely additive: CREATE INDEX IF NOT EXISTS, no column/schema change, no data change. Does NOT alter
-- what the viewer returns (rows/order/totals/filters/pagination unchanged) — only how fast it fetches.
-- Idempotent: re-run is a clean no-op.

-- Primary fix: RH sort column (the unbounded table).
CREATE INDEX IF NOT EXISTS idx_rha_entered_at_utc
  ON running_hours_audit (entered_at_utc DESC);

-- Same issue on the postponement sort column.
CREATE INDEX IF NOT EXISTS idx_postponement_created_at
  ON work_order_postponements (created_at DESC);

-- Dominant source: keep the audit_log recency scan tight as soft-disposed rows accumulate.
-- Partial index matches the viewer's standing predicate (disposed_at IS NULL) + its ORDER BY timestamp DESC.
CREATE INDEX IF NOT EXISTS idx_audit_timestamp_active
  ON audit_log (timestamp DESC)
  WHERE disposed_at IS NULL;

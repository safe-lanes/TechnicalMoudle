-- Migration 115: Create sync_connectivity_log table
-- Records every auto-sync attempt (success and failure) for queryable
-- client-side VSAT connectivity reporting.
--
-- Purpose: On ships with intermittent VSAT, the crew and shore admin need a
-- historical view of when sync was attempted, whether it reached shore, and
-- what error category was encountered on failure.

CREATE TABLE IF NOT EXISTS sync_connectivity_log (
  id            SERIAL PRIMARY KEY,
  log_uuid      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  instance_id   TEXT NOT NULL,
  vessel_id     TEXT,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome       TEXT NOT NULL CHECK (outcome IN ('success', 'network_unreachable', 'timeout', 'server_error', 'client_error', 'unknown_error', 'skipped_reentrant', 'skipped_disabled')),
  error_message TEXT,
  error_category TEXT,
  latency_ms    INTEGER,
  batch_uuid    TEXT,
  records_pushed INTEGER DEFAULT 0,
  records_pulled INTEGER DEFAULT 0,
  catch_up_cycle INTEGER DEFAULT 0,
  trigger_type  TEXT NOT NULL DEFAULT 'auto' CHECK (trigger_type IN ('auto', 'manual', 'catch_up')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-range queries (dashboard, CSV export)
CREATE INDEX IF NOT EXISTS idx_sync_connectivity_log_vessel_time
  ON sync_connectivity_log (vessel_id, attempted_at DESC);

-- Index for outcome filtering
CREATE INDEX IF NOT EXISTS idx_sync_connectivity_log_outcome
  ON sync_connectivity_log (outcome, attempted_at DESC);

-- Seed new settings for catch-up behaviour
INSERT INTO sync_settings (ssuuid, setting_key, setting_value, setting_type, description, is_editable)
VALUES
  (gen_random_uuid()::text, 'catch_up_max_cycles', '20', 'number', 'Maximum consecutive catch-up sync cycles when backlog exceeds batch size. 0 = no catch-up.', true)
ON CONFLICT (setting_key) DO NOTHING;

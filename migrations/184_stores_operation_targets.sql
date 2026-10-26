-- Server-side Stores selections contain IDs only, not inventory records.
-- Kept in the tenant DB so multi-instance routing/restarts do not lose selection.
-- Transient operational state: deliberately excluded from vessel sync.
CREATE TABLE IF NOT EXISTS stores_operation_targets (
  token TEXT PRIMARY KEY,
  owner_uuid TEXT NOT NULL,
  item_type TEXT NOT NULL,
  targets JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stores_operation_targets_owner_idx ON stores_operation_targets(owner_uuid);

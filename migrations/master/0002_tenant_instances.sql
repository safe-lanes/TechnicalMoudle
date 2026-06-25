-- Master DB ship-instance -> domain map (multi-tenant mode).
-- Applied ONLY against MASTER_DATABASE_URL by tenantConnectionManager.init().
-- Never run against the single/default DB or any tenant DB. Idempotent.
--
-- Purpose (Phase 4): shore recovers an incoming ship's instance id from
-- batch.initiatedByInstance and must map it to the owning tenant `domain` to
-- validate the ship-declared X-Sync-Domain fail-closed (enforcement is Phase 4b;
-- 4a only establishes + populates this map). Keyed on instance_id because that is
-- the identity shore recovers on the wire.
CREATE TABLE IF NOT EXISTS tenant_instances (
  instance_id TEXT PRIMARY KEY,
  vessel_id   TEXT,
  domain      TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

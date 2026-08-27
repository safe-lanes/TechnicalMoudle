-- Master DB ship-instance -> { domain, sync_api_key } map (multi-tenant mode).
-- Applied ONLY against MASTER_DATABASE_URL by tenantConnectionManager.init().
-- Never run against the single/default DB or any tenant DB. Idempotent.
--
-- Purpose (Phase 4): shore recovers an incoming ship's instance id from the
-- X-Sync-Instance-Id header, looks up the owning tenant `domain` here to route to
-- the tenant DB, and validates the caller's X-Sync-Api-Key against `sync_api_key`
-- here — at the MASTER level, BEFORE any tenant DB is opened (fail-closed front
-- door). Keyed on instance_id (the wire identity). The ship NEVER declares its
-- domain; shore is the sole authority (Phase 4b simplified design).
CREATE TABLE IF NOT EXISTS tenant_instances (
  instance_id  TEXT PRIMARY KEY,
  vessel_id    TEXT,
  domain       TEXT NOT NULL,
  sync_api_key TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Phase 4b: add the per-tenant key column to master DBs that already have the
-- 4a table (CREATE IF NOT EXISTS above won't alter an existing table).
ALTER TABLE tenant_instances ADD COLUMN IF NOT EXISTS sync_api_key TEXT;

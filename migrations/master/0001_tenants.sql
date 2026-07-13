-- Master DB registry of tenants (multi-tenant mode).
-- Applied ONLY against MASTER_DATABASE_URL by tenantConnectionManager.init().
-- Never run against the single/default DB or any tenant DB. Idempotent.
-- Same-PostgreSQL model: all tenant DBs share the master server host/credentials;
-- only database_name varies. No per-tenant URL/credentials stored.
CREATE TABLE IF NOT EXISTS tenants (
  id            SERIAL PRIMARY KEY,
  domain        TEXT NOT NULL UNIQUE,
  tuid          TEXT NOT NULL,
  database_name TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Master DB (multi-tenant): chatbot Stage A.
-- Applied ONLY against MASTER_DATABASE_URL by tenantConnectionManager.init().
-- Never run against the single/default DB or any tenant DB. Idempotent (re-run safe).

-- 1) Per-tenant AI assistant on/off. Default true = current behavior preserved
--    (existing tenants keep the working chatbot); disable specific tenants as needed.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) Central chatbot interaction log — ONE Safe-Lanes ops table, tenant-tagged via tuid,
--    so the internal admin gets a cross-tenant view + per-tenant cost roll-up (GROUP BY tuid)
--    from a single place. Lives in the MASTER DB in multi-tenant mode. In single-tenant mode
--    the same table is created in the single/default DB (by the app's lazy ensure) with tuid NULL.
--    Rows are written fire-and-forget AFTER the chat response; admin-only store; full answer kept.
CREATE TABLE IF NOT EXISTS chatbot_interactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tuid            TEXT,
  domain          TEXT,
  user_id         TEXT,
  user_name       TEXT,
  user_role       TEXT,
  vessel_id       TEXT,
  conversation_id TEXT,
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  tools_used      JSONB,
  docs_retrieved  JSONB,
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  latency_ms      INTEGER,
  model           TEXT,
  provider        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_tuid ON chatbot_interactions (tuid);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_created_at ON chatbot_interactions (created_at);

/**
 * The service's OWN Postgres store (Stage 2) — registration/settings matrix,
 * conversation log, ratings, notifications. This is the "central Safe Lanes ops
 * store" of the architecture plan §4.1: the conversation log lives HERE, not in
 * the PMS master DB (the dependency the plan called out). Local service DB —
 * never a tenant DB, never synced.
 */
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assistant_pairs (
      id            SERIAL PRIMARY KEY,
      tenant_domain TEXT NOT NULL,
      tuid          TEXT,
      module        TEXT NOT NULL,
      enabled       BOOLEAN NOT NULL DEFAULT TRUE,
      first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used     TIMESTAMPTZ,
      UNIQUE (tenant_domain, module)
    );
    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id              BIGSERIAL PRIMARY KEY,
      ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
      tenant_domain   TEXT,
      tuid            TEXT,
      user_id         TEXT,
      user_name       TEXT,
      user_role       TEXT,
      module          TEXT,
      gate            TEXT,
      question        TEXT,
      answer          TEXT,
      citations       JSONB,
      confidence      REAL,
      tokens_in       INT,
      tokens_out      INT,
      latency_ms      INT,
      model           TEXT,
      conversation_id TEXT
    );
    ALTER TABLE assistant_conversations ADD COLUMN IF NOT EXISTS tools_used JSONB;
    CREATE TABLE IF NOT EXISTS assistant_ratings (
      id              BIGSERIAL PRIMARY KEY,
      ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
      conversation_id TEXT,
      rating          SMALLINT NOT NULL,
      rated_by        TEXT,
      note            TEXT
    );
    CREATE TABLE IF NOT EXISTS assistant_notifications (
      id              BIGSERIAL PRIMARY KEY,
      ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
      type            TEXT NOT NULL,
      payload         JSONB,
      delivered       BOOLEAN NOT NULL DEFAULT FALSE,
      delivery_detail TEXT
    );
  `);
}

/** Look up the pair; register it (default ON) on first sight. Returns {pair, isNew}. */
export async function resolvePair(tenantDomain, tuid, module) {
  const sel = await pool.query(
    'SELECT * FROM assistant_pairs WHERE tenant_domain=$1 AND module=$2',
    [tenantDomain, module],
  );
  if (sel.rows.length) {
    void pool.query('UPDATE assistant_pairs SET last_used=now() WHERE id=$1', [sel.rows[0].id])
      .catch(() => {});
    return { pair: sel.rows[0], isNew: false };
  }
  const ins = await pool.query(
    `INSERT INTO assistant_pairs (tenant_domain, tuid, module, last_used)
     VALUES ($1,$2,$3,now())
     ON CONFLICT (tenant_domain, module) DO UPDATE SET last_used=now()
     RETURNING *, (xmax = 0) AS inserted`,
    [tenantDomain, tuid || null, module],
  );
  return { pair: ins.rows[0], isNew: ins.rows[0].inserted === true };
}

export async function logConversation(row) {
  await pool.query(
    `INSERT INTO assistant_conversations
       (tenant_domain, tuid, user_id, user_name, user_role, module, gate, question, answer,
        citations, confidence, tokens_in, tokens_out, latency_ms, model, conversation_id, tools_used)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [row.tenantDomain, row.tuid, row.userId, row.userName, row.userRole, row.module, row.gate,
     row.question, row.answer, JSON.stringify(row.citations || []), row.confidence,
     row.tokensIn, row.tokensOut, row.latencyMs, row.model, row.conversationId,
     JSON.stringify(row.toolsUsed || [])],
  );
}

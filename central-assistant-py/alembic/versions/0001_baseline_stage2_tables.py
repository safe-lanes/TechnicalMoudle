"""Baseline — the four Stage-2 tables exactly as the Node service created them.

IF NOT EXISTS throughout: the live sail-assistant-db already has these (created by
db.mjs initSchema at boot); a fresh DB gets them here. Idempotent on re-run.

Revision ID: 0001
Revises:
Create Date: 2026-09-11
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    """asyncpg prepares one statement at a time — run each ';'-terminated statement separately."""
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
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
    """)


def downgrade() -> None:
    # Baseline of live data — never dropped by a downgrade.
    pass

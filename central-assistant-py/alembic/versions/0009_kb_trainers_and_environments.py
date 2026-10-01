"""Knowledge management, final pilot requirements (1-Oct-2026): configurable module trainers and explicit environment scope.

- kb_trainers — who may manage knowledge, per MODULE, matched on the verified identity's issuer (environment instance),
  company (tenant domain) and user id. publish_scope 'company' (own company only) or 'global' (product-wide, only when
  explicitly granted); share_envs allows publishing guidance shared across environments. Revoking sets revoked_at: the
  next request of an existing session is refused (grants are read per request). History is kept.
- Environment scope: kb_entries.env_scope / assistant_chunks.kb_env / kb_supersedes.env_scope hold the environment
  label of the registered instance ('dev', 'prod', …) or '*' for guidance intentionally shared by all environments.
  Knowledge chunks and supersedes without an environment are never served (fail closed).
- kb_review_items.env and kb_sessions.env / user_type record where a report or a session came from.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-01
"""
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    CREATE TABLE IF NOT EXISTS kb_trainers (
      id BIGSERIAL PRIMARY KEY,
      issuer TEXT NOT NULL,
      tenant_domain TEXT NOT NULL,
      user_id TEXT NOT NULL,
      module TEXT NOT NULL,
      publish_scope TEXT NOT NULL,
      share_envs BOOLEAN NOT NULL DEFAULT false,
      display_name TEXT,
      note TEXT NOT NULL DEFAULT '',
      granted_by TEXT NOT NULL,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_by TEXT,
      revoked_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS kb_trainers_active_idx ON kb_trainers (issuer, tenant_domain, user_id, module) WHERE revoked_at IS NULL;
    ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS env_scope TEXT;
    ALTER TABLE assistant_chunks ADD COLUMN IF NOT EXISTS kb_env TEXT;
    ALTER TABLE kb_supersedes ADD COLUMN IF NOT EXISTS env_scope TEXT;
    ALTER TABLE kb_review_items ADD COLUMN IF NOT EXISTS env TEXT;
    ALTER TABLE kb_sessions ADD COLUMN IF NOT EXISTS env TEXT;
    ALTER TABLE kb_sessions ADD COLUMN IF NOT EXISTS user_type TEXT
    """)


def downgrade() -> None:
    _execute_each("""
    ALTER TABLE kb_sessions DROP COLUMN IF EXISTS user_type;
    ALTER TABLE kb_sessions DROP COLUMN IF EXISTS env;
    ALTER TABLE kb_review_items DROP COLUMN IF EXISTS env;
    ALTER TABLE kb_supersedes DROP COLUMN IF EXISTS env_scope;
    ALTER TABLE assistant_chunks DROP COLUMN IF EXISTS kb_env;
    ALTER TABLE kb_entries DROP COLUMN IF EXISTS env_scope;
    DROP TABLE IF EXISTS kb_trainers
    """)

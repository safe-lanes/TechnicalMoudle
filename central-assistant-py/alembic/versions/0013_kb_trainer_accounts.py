"""Trainer accounts with their own login on the training page (owner decision 6-Oct-2026): the domain team trains, so
trainers sign in with a user id + password managed on the AI server (SAILERP role integration postponed). Each account
lists the modules it may train. Sessions record the account, so disabling or resetting it ends them. Idempotent.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-06
"""
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    CREATE TABLE IF NOT EXISTS kb_accounts (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      modules TEXT[] NOT NULL DEFAULT '{}',
      password_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      disabled_by TEXT,
      disabled_at TIMESTAMPTZ
    );
    ALTER TABLE kb_sessions ADD COLUMN IF NOT EXISTS account_id BIGINT
    """)


def downgrade() -> None:
    _execute_each("""
    DELETE FROM kb_sessions WHERE account_id IS NOT NULL;
    ALTER TABLE kb_sessions DROP COLUMN IF EXISTS account_id;
    DROP TABLE IF EXISTS kb_accounts
    """)

"""Postgres-backed sliding-window rate limiter (Audit-4 fix: the Node limiter was an
in-process Map, not multi-instance safe). Rows older than the window are pruned on each
check for that user; a per-user advisory lock keeps the count exact under bursts.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-11
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    CREATE TABLE IF NOT EXISTS assistant_rate_hits (
      user_id TEXT NOT NULL,
      ts      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX IF NOT EXISTS assistant_rate_hits_user_ts_idx ON assistant_rate_hits (user_id, ts);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS assistant_rate_hits")

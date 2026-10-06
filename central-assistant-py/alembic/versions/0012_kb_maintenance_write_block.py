"""Knowledge write block for a safe fast rollback (6-Oct-2026): one row that says whether knowledge changes are paused.
Every knowledge write takes a shared advisory lock and checks it inside its own transaction; `kb_admin writes-block`
takes the exclusive lock (so it waits for writes already in progress) and sets it. Idempotent: a second run changes nothing.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-06
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    CREATE TABLE IF NOT EXISTS kb_maintenance (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      writes_blocked BOOLEAN NOT NULL DEFAULT false,
      reason TEXT NOT NULL DEFAULT '',
      changed_by TEXT,
      changed_at TIMESTAMPTZ
    );
    INSERT INTO kb_maintenance (id, writes_blocked) SELECT 1, false WHERE NOT EXISTS (SELECT 1 FROM kb_maintenance WHERE id = 1)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS kb_maintenance")

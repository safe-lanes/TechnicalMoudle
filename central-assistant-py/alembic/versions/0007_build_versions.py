"""Reproducible index builds — record the CLEANUP and CHUNKER code versions per document
and per chunk set, separately from the parse (owner ask 14-Sep-2026): a chunker or cleanup
change must invalidate the index even when the accepted parse is still valid.

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-14
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS cleanup_version TEXT;
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS chunker_version TEXT;
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS build_key TEXT
    """)


def downgrade() -> None:
    _execute_each("""
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS build_key;
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS chunker_version;
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS cleanup_version
    """)

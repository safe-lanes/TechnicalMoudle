"""Document provenance — record on every parse the REQUESTED parser version (the API does
not return the effective one — unverifiable from our side, owner informed 14-Sep-2026),
the LlamaParse job id, whether pre-chunk cleanup ran, and how many cross-references were
resolved/unresolved.

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-14
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS job_id TEXT;
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS cleaned BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS xrefs_resolved INT NOT NULL DEFAULT 0;
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS xrefs_unresolved INT NOT NULL DEFAULT 0;
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS clean_report JSONB
    """)


def downgrade() -> None:
    _execute_each("""
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS clean_report;
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS xrefs_unresolved;
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS xrefs_resolved;
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS cleaned;
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS job_id
    """)

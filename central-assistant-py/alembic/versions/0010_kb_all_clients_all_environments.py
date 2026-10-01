"""Knowledge management, owner decision 1-Oct-2026: trainers are SAIL staff who train each module for ALL clients and
ALL environments (one central assistant, trained on dev). Existing knowledge is made product-wide and shared by every
environment, so it stays editable and served under the new rule. Company-scoped knowledge (none exists outside the
pilot) is left untouched and therefore stays unserved to other companies. Idempotent: a second run changes nothing.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-01
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    UPDATE kb_entries SET env_scope = '*' WHERE scope_tenant IS NULL AND env_scope IS DISTINCT FROM '*';
    UPDATE assistant_chunks SET kb_env = '*' WHERE kb_state IS NOT NULL AND tenant_domain IS NULL AND kb_env IS DISTINCT FROM '*';
    UPDATE kb_supersedes SET env_scope = '*' WHERE tenant_domain IS NULL AND env_scope IS DISTINCT FROM '*'
    """)


def downgrade() -> None:
    pass  # the earlier per-environment labels are not recoverable; '*' stays valid under 0009 as well

"""Knowledge trainers, owner decision 5-Oct-2026: training happens on DEV only (our own SAILERP, one login for all
modules), so a trainer is matched on the dev instance (issuer) + user id; the company is no longer part of the match.
tenant_domain stays as an optional, informational column (history keeps the old values). Where one person had active
grants for the same issuer + module under several companies, the newest stays active and the rest are revoked, so the
new unique key holds. Idempotent: a second run changes nothing.

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-05
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    ALTER TABLE kb_trainers ALTER COLUMN tenant_domain DROP NOT NULL;
    UPDATE kb_trainers t SET revoked_at = now(), revoked_by = 'migration 0011 (duplicate per user + module)'
      WHERE t.revoked_at IS NULL AND EXISTS (
        SELECT 1 FROM kb_trainers n WHERE n.revoked_at IS NULL AND n.issuer = t.issuer AND n.user_id = t.user_id
          AND n.module = t.module AND (n.granted_at, n.id) > (t.granted_at, t.id));
    DROP INDEX IF EXISTS kb_trainers_active_idx;
    CREATE UNIQUE INDEX IF NOT EXISTS kb_trainers_active_user_idx ON kb_trainers (issuer, user_id, module) WHERE revoked_at IS NULL
    """)


def downgrade() -> None:
    _execute_each("""
    DROP INDEX IF EXISTS kb_trainers_active_user_idx;
    CREATE UNIQUE INDEX IF NOT EXISTS kb_trainers_active_idx ON kb_trainers (issuer, tenant_domain, user_id, module) WHERE revoked_at IS NULL
    """)

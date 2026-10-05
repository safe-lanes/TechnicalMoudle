"""Knowledge management (owner brief 30-Sep-2026): owner-published knowledge entries with revisions,
preview, supersede and review items, all additive.

- assistant_chunks gains tenant_domain (NULL = global), kb_entry_id and kb_state (NULL = document chunk,
  'published' = served, 'preview' = only the owner's preview request can retrieve it).
- kb_entries / kb_revisions — an entry and its full revision history (rollback = re-publish an earlier revision).
- kb_supersedes — the passages a PUBLISHED entry replaces, scoped to the entry's company (NULL = everyone).
- kb_review_items — answers reported by users; they never change the KB by themselves.
- kb_sessions — the knowledge screen's server-side session, created from a verified signed identity.
- kb_audit — who did what to which entry, and when.

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-30
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    ALTER TABLE assistant_chunks ADD COLUMN IF NOT EXISTS tenant_domain TEXT;
    ALTER TABLE assistant_chunks ADD COLUMN IF NOT EXISTS kb_entry_id TEXT;
    ALTER TABLE assistant_chunks ADD COLUMN IF NOT EXISTS kb_state TEXT;
    CREATE INDEX IF NOT EXISTS assistant_chunks_kb_entry_idx ON assistant_chunks (kb_entry_id);

    CREATE TABLE IF NOT EXISTS kb_entries (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      scope_tenant TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_revision INTEGER,
      draft_revision INTEGER,
      created_by TEXT NOT NULL,
      created_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS kb_entries_module_idx ON kb_entries (module, status);

    CREATE TABLE IF NOT EXISTS kb_revisions (
      entry_id TEXT NOT NULL REFERENCES kb_entries(id),
      revision INTEGER NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      applies_to JSONB NOT NULL DEFAULT '{}'::jsonb,
      evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
      open_points JSONB NOT NULL DEFAULT '[]'::jsonb,
      supersedes JSONB NOT NULL DEFAULT '[]'::jsonb,
      internal_notes TEXT NOT NULL DEFAULT '',
      change_note TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL,
      author_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      published_at TIMESTAMPTZ,
      published_by TEXT,
      published_by_name TEXT,
      PRIMARY KEY (entry_id, revision)
    );

    CREATE TABLE IF NOT EXISTS kb_supersedes (
      entry_id TEXT NOT NULL REFERENCES kb_entries(id),
      index_set TEXT NOT NULL,
      chunk_id TEXT NOT NULL,
      tenant_domain TEXT,
      PRIMARY KEY (entry_id, index_set, chunk_id)
    );
    CREATE INDEX IF NOT EXISTS kb_supersedes_chunk_idx ON kb_supersedes (index_set, chunk_id);

    CREATE TABLE IF NOT EXISTS kb_review_items (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      tenant_domain TEXT,
      iss TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL DEFAULT '',
      citations JSONB NOT NULL DEFAULT '[]'::jsonb,
      note TEXT NOT NULL DEFAULT '',
      reporter_id TEXT NOT NULL,
      reporter_name TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      entry_id TEXT,
      resolution TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS kb_review_items_status_idx ON kb_review_items (module, status);

    CREATE TABLE IF NOT EXISTS kb_sessions (
      id TEXT PRIMARY KEY,
      token_sha TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      user_name TEXT,
      role TEXT,
      tenant_domain TEXT,
      iss TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kb_audit (
      id BIGSERIAL PRIMARY KEY,
      entry_id TEXT,
      revision INTEGER,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT,
      at TIMESTAMPTZ NOT NULL DEFAULT now(),
      detail JSONB NOT NULL DEFAULT '{}'::jsonb
    )
    """)


def downgrade() -> None:
    # 5-Oct-2026: knowledge rows (published AND private preview) live in assistant_chunks; remove them BEFORE dropping
    # the columns that mark them, otherwise an older image would serve them as ordinary manual passages.
    _execute_each("""
    DELETE FROM assistant_chunks WHERE kb_state IS NOT NULL OR kb_entry_id IS NOT NULL;
    DROP TABLE IF EXISTS kb_audit;
    DROP TABLE IF EXISTS kb_sessions;
    DROP TABLE IF EXISTS kb_review_items;
    DROP TABLE IF EXISTS kb_supersedes;
    DROP TABLE IF EXISTS kb_revisions;
    DROP TABLE IF EXISTS kb_entries;
    DROP INDEX IF EXISTS assistant_chunks_kb_entry_idx;
    ALTER TABLE assistant_chunks DROP COLUMN IF EXISTS kb_state;
    ALTER TABLE assistant_chunks DROP COLUMN IF EXISTS kb_entry_id;
    ALTER TABLE assistant_chunks DROP COLUMN IF EXISTS tenant_domain
    """)

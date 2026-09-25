"""Index sets + document manifest — lets a freshly indexed corpus live beside the
migrated one for measured comparison, and gives the indexer a per-document manifest
(sha256, chunk count, parser tier/version) so a single manual can be re-indexed alone.

- assistant_chunks.index_set: 'migrated' (the 907 chunks moved from Chroma) vs any set the
  Python indexer writes (e.g. 'py-llamaparse'). The service reads ONE set (ASSISTANT_INDEX_SET).
- primary key becomes (index_set, id): chunk ids are content-derived, so the same text in two
  sets shares an id by design.

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-11
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    ALTER TABLE assistant_chunks ADD COLUMN IF NOT EXISTS index_set TEXT NOT NULL DEFAULT 'migrated';
    ALTER TABLE assistant_chunks DROP CONSTRAINT IF EXISTS assistant_chunks_pkey;
    ALTER TABLE assistant_chunks ADD PRIMARY KEY (index_set, id);
    CREATE INDEX IF NOT EXISTS assistant_chunks_set_file_idx ON assistant_chunks (index_set, file);
    CREATE TABLE IF NOT EXISTS assistant_documents (
      index_set     TEXT NOT NULL,
      file          TEXT NOT NULL,
      module        TEXT NOT NULL,
      sha256        TEXT NOT NULL,
      source_type   TEXT NOT NULL,
      chunks        INT NOT NULL DEFAULT 0,
      pages         INT,
      stub          BOOLEAN NOT NULL DEFAULT FALSE,
      parser        TEXT,
      parser_tier   TEXT,
      parser_version TEXT,
      embed_model   TEXT,
      indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (index_set, file)
    )
    """)


def downgrade() -> None:
    _execute_each("""
    DROP TABLE IF EXISTS assistant_documents;
    ALTER TABLE assistant_chunks DROP CONSTRAINT IF EXISTS assistant_chunks_pkey;
    ALTER TABLE assistant_chunks ADD PRIMARY KEY (id);
    ALTER TABLE assistant_chunks DROP COLUMN IF EXISTS index_set
    """)

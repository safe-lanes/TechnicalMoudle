"""Knowledge chunks in pgvector — replaces the standalone Chroma server (owner decision
11-Sep: "I do not want two stores"). Needs the pgvector/pgvector:pg16 image.

No ANN index: 907 rows scan in well under a millisecond, and pgvector's HNSW/IVFFlat cap
the `vector` type at 2000 dims (ours are 3072; a halfvec index is the route if the
corpus ever grows large). The tsvector column is generated for future hybrid search
(NOT used for ranking in the port — retrieval-quality changes are a separate measured step).

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-11
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    _execute_each("""
    CREATE TABLE IF NOT EXISTS assistant_chunks (
      id             TEXT PRIMARY KEY,                 -- Chroma id (sha1 of node) carried over
      module         TEXT NOT NULL,
      file           TEXT,
      section_title  TEXT,
      breadcrumb     TEXT,
      page_number    TEXT,
      chunk_index    INT,
      content        TEXT NOT NULL,
      metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
      embedding      vector(3072) NOT NULL,
      tsv            tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
      indexed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS assistant_chunks_module_idx ON assistant_chunks (module);
    CREATE INDEX IF NOT EXISTS assistant_chunks_tsv_idx ON assistant_chunks USING GIN (tsv);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS assistant_chunks")

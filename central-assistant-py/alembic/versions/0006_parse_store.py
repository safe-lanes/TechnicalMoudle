"""Parse store — the ACCEPTED parse of each source file, keyed by file hash + parsing
configuration, kept durably in the service DB (owner design decision 14-Sep-2026): when the
file and the configuration are unchanged, the index is rebuilt from the saved parse and the
parser is never called — run-to-run parser variance only ever enters when a document changes.

Also the evidence bundle for the "metadata.version" discrepancy: raw response retained, API
endpoint/version recorded, job id recorded, and a flag saying whether the documented version
field was present in the response.

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-14
"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def _execute_each(sql: str) -> None:
    for stmt in (s.strip() for s in sql.split(";")):
        if stmt:
            op.execute(stmt)


def upgrade() -> None:
    _execute_each("""
    CREATE TABLE IF NOT EXISTS assistant_parses (
      parse_key        TEXT PRIMARY KEY,               -- sha256(file) | tier | requested version | options hash
      file             TEXT NOT NULL,
      sha256           TEXT NOT NULL,
      tier             TEXT NOT NULL,
      requested_version TEXT NOT NULL,
      options          JSONB NOT NULL,
      api_endpoint     TEXT NOT NULL,                  -- e.g. api.cloud.llamaindex.ai/api/v2/parse
      job_id           TEXT,
      response_version_field TEXT,                     -- value of metadata.version if the response carried it
      version_field_present BOOLEAN NOT NULL DEFAULT FALSE,
      raw_response     JSONB NOT NULL,                 -- the untouched parse result (reversible cleanup)
      pages            INT,
      parsed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      accepted         BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE INDEX IF NOT EXISTS assistant_parses_file_idx ON assistant_parses (file, parsed_at DESC);
    ALTER TABLE assistant_documents ADD COLUMN IF NOT EXISTS parse_key TEXT
    """)


def downgrade() -> None:
    _execute_each("""
    ALTER TABLE assistant_documents DROP COLUMN IF EXISTS parse_key;
    DROP TABLE IF EXISTS assistant_parses
    """)

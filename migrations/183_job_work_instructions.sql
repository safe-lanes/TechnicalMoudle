-- 183: Job Form "Work Instructions" — PDF attachments on Vessel Jobs (Jeevan's requirement, 25-Oct-2026;
-- plan docs/output/JOB-WORK-INSTRUCTIONS-IMPLEMENTATION-PLAN.md; decisions D1-D5 by Ghazi).
--
-- Two tables, both synced office -> ship (ONE_WAY_SHORE_TO_SHIP; the office writes, ships read):
--   job_work_instruction_files  one physical PDF per vessel (file bytes travel by the existing file sync)
--   job_work_instruction_links  one Job <-> file link; "remove" soft-deletes the link ONLY, the shared file stays
--                               for the other Jobs; "restore" clears the deletion.
-- Both are keyed by a UUID from day one (the per-instance integer-id collision that bit component_documents, mig 182,
-- cannot happen here). No CHECK constraints on synced text. Additive and idempotent: second run = no-op.

CREATE TABLE IF NOT EXISTS job_work_instruction_files (
  jwfuuid           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vessel_id         TEXT NOT NULL,                          -- vessels.vuuid: scope, uniqueness and sync key
  file_name         TEXT NOT NULL,                          -- safe display name, ends with .pdf
  file_key          TEXT NOT NULL,                          -- private storage key (server-made), never a public URL
  storage_backend   TEXT NOT NULL DEFAULT 'local',          -- 'local' | 'object' (as component_documents)
  content_type      TEXT NOT NULL DEFAULT 'application/pdf',
  file_size         INTEGER,
  revision_remarks  TEXT,                                   -- optional (requirement §9) — not version control
  uploaded_by_uuid  TEXT,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_uuid   TEXT,
  updated_by_uuid   TEXT,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  is_sync           BOOLEAN NOT NULL DEFAULT FALSE
);
-- One ACTIVE file name per vessel (requirement §6/§18); a removed file frees its name.
CREATE UNIQUE INDEX IF NOT EXISTS uq_jwi_files_vessel_name_active
  ON job_work_instruction_files (vessel_id, lower(file_name)) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_jwi_files_vessel ON job_work_instruction_files (vessel_id, is_deleted);

CREATE TABLE IF NOT EXISTS job_work_instruction_links (
  jwluuid           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id            TEXT NOT NULL,                          -- jobs.juuid (no FK: a ship may receive the link before the Job in the same batch)
  file_uuid         TEXT NOT NULL,                          -- job_work_instruction_files.jwfuuid (no FK: same reason)
  vessel_id         TEXT NOT NULL,                          -- must equal the Job's and the file's vessel (service-checked)
  attached_by_uuid  TEXT,
  attached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_uuid   TEXT,
  updated_by_uuid   TEXT,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  is_sync           BOOLEAN NOT NULL DEFAULT FALSE
);
-- One ACTIVE link per (Job, file): idempotent bulk import (§13) and the restore duplicate check (§8).
CREATE UNIQUE INDEX IF NOT EXISTS uq_jwi_links_job_file_active
  ON job_work_instruction_links (job_id, file_uuid) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_jwi_links_job ON job_work_instruction_links (job_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_jwi_links_file ON job_work_instruction_links (file_uuid);
CREATE INDEX IF NOT EXISTS idx_jwi_links_vessel ON job_work_instruction_links (vessel_id);

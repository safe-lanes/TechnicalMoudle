-- Run only in a disposable PostgreSQL database; no production inventory or data.
\set ON_ERROR_STOP on
CREATE TABLE jobs (
  juuid TEXT PRIMARY KEY,
  level2_reviewer_rank_id TEXT,
  last_done_rh TEXT,
  next_due_rh TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO jobs VALUES ('fixture-job', 'Office', '1000', '1100', NOW());

\i migrations/180_jobs_office_reviewer_role_ruids.sql
\i migrations/180_jobs_office_reviewer_role_ruids.sql

DO $$ BEGIN
  IF (SELECT office_reviewer_role_ruids FROM jobs WHERE juuid = 'fixture-job') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Existing rows must begin with no configured roles';
  END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'jobs' AND column_name = 'office_reviewer_role_ruids') <> 'jsonb' THEN
    RAISE EXCEPTION 'Reviewer column must be JSONB';
  END IF;
END $$;

PREPARE save_roles(JSONB, TEXT) AS
  UPDATE jobs SET office_reviewer_role_ruids = $1, updated_at = NOW() WHERE juuid = $2;
EXECUTE save_roles('["role-A","role-C"]', 'fixture-job');
DO $$ BEGIN
  IF (SELECT office_reviewer_role_ruids FROM jobs) <> '["role-A","role-C"]'::jsonb
     OR (SELECT jsonb_typeof(office_reviewer_role_ruids) FROM jobs) <> 'array' THEN
    RAISE EXCEPTION 'Selections must round-trip as arrays, not encoded JSON strings';
  END IF;
END $$;
EXECUTE save_roles('["role-C"]', 'fixture-job');
DO $$ BEGIN
  IF (SELECT office_reviewer_role_ruids FROM jobs) <> '["role-C"]'::jsonb THEN
    RAISE EXCEPTION 'Saves must replace complete selection';
  END IF;
END $$;
EXECUTE save_roles('[]', 'fixture-job');
INSERT INTO jobs (juuid) VALUES ('fixture-created');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM jobs WHERE office_reviewer_role_ruids <> '[]'::jsonb) THEN
    RAISE EXCEPTION 'Clears and new-row defaults must be empty arrays';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jobs WHERE juuid = 'fixture-job'
      AND level2_reviewer_rank_id = 'Office' AND last_done_rh = '1000' AND next_due_rh = '1100') THEN
    RAISE EXCEPTION 'Legacy and protected tracking values must remain unchanged';
  END IF;
END $$;
EXECUTE save_roles(NULL, 'fixture-job');
DO $$ BEGIN
  IF (SELECT office_reviewer_role_ruids FROM jobs WHERE juuid = 'fixture-job') IS NOT NULL THEN
    RAISE EXCEPTION 'Column must retain NULL compatibility';
  END IF;
END $$;

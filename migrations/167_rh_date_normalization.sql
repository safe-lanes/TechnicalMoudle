-- Task #427: RH date-format poisoning — canonicalize running_hours_audit.date_updated_local.
--
-- Background: date_updated_local is free text holding a vessel-local CALENDAR DAY.
-- Legacy writers emitted en-GB locale strings ("01 Apr 2020 05:30", "01 Sept 2026 …").
-- The latest-reading-wins comparator could only rank ISO rows in SQL; any non-ISO row
-- fell back to entered_at_utc::date, so a backdated legacy row entered today ranked as
-- observed TODAY and beat genuinely newer readings.
--
-- This migration (idempotent, safe to re-run):
--  (a) re-creates safe_parse_rh_date_local() — some external deployments never ran
--      migration 166 (proven by a live 22007 crash);
--  (b) creates safe_rh_reading_day(text) RETURNS date — the DATE-returning wrapper all
--      SQL reads of the column use. Session-timezone-safe: TO_TIMESTAMP interprets the
--      text in the session TZ and the ::date cast converts back in the SAME TZ, so the
--      literal calendar day always round-trips regardless of session timezone.
--  (c) creates the LOCAL, NON-SYNCED backup table rh_date_normalization_backup — locale
--      strings cannot be reconstructed from ISO, so this is the rollback path. This
--      table must NEVER be added to the sync table registry.
--  (d) rewrites every non-ISO date_updated_local the parser can handle to YYYY-MM-DD.
--      Unparseable rows are left untouched (never blanked, never guessed) — every SQL
--      read goes through safe_rh_reading_day() and treats them as NULL (entered_at
--      fallback), so no query can crash on them.
--
-- SYNC PROTOCOL (deliberate choice): this UPDATE is raw SQL — it emits NO sync field
-- logs (field logging is application-level via logFieldChanges). Every installation
-- runs this same idempotent migration locally, so ship and shore converge WITHOUT
-- transport and with zero fleet-wide sync burst. A pre-existing unsynced field log
-- carrying legacy text may still arrive later; that is harmless — the receiving side's
-- readers parse legacy text safely, and its own migration has already normalized its
-- local rows (normalization only touches non-ISO rows, so it cannot ping-pong).

-- (a) Re-create the crash-proof parser (identical to migrations/166).
CREATE OR REPLACE FUNCTION safe_parse_rh_date_local(input text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  normalized text;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;

  -- ISO prefix branch (YYYY-MM-DD...), same as the legacy expression.
  IF input ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
    BEGIN
      RETURN TO_TIMESTAMP(input, 'YYYY-MM-DD');
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL; -- e.g. "2025-13-40": month/day out of range
    END;
  END IF;

  -- DD-Mon-YYYY[-HH24:MI] branch after space->dash replacement, with any LONG
  -- month name (Sept, June, July, September, ...) truncated to 3 letters.
  normalized := REGEXP_REPLACE(REPLACE(input, ' ', '-'), '-([A-Za-z]{3})[A-Za-z]+-', '-\1-');
  IF normalized ~* '^[0-9]{1,2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-[0-9]{4}' THEN
    BEGIN
      RETURN TO_TIMESTAMP(normalized, 'DD-Mon-YYYY-HH24:MI');
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL; -- e.g. "31-Feb-2025", "15-Sep-2025-99:99"
    END;
  END IF;

  RETURN NULL; -- unrecognized shape
END;
$fn$;

-- (b) Calendar-day wrapper: DATE-returning, session-timezone-safe (see header).
--     This is THE parse entry point for winner selection, rotation filtering and
--     any ranking of date_updated_local. Parity contract with the JS parser in
--     server/modules/running-hours/utils/readingDate.ts.
CREATE OR REPLACE FUNCTION safe_rh_reading_day(input text)
RETURNS date
LANGUAGE sql
STABLE
AS $fn$
  SELECT (safe_parse_rh_date_local(input))::date;
$fn$;

-- (c) Rollback-preservation backup table. LOCAL ONLY — never synced.
CREATE TABLE IF NOT EXISTS rh_date_normalization_backup (
  rhauuid text NOT NULL,
  old_text text NOT NULL,
  new_text text NOT NULL,
  migration_version text NOT NULL DEFAULT '167',
  migrated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rhauuid, migration_version)
);
COMMENT ON TABLE rh_date_normalization_backup IS
  'Task #427: original date_updated_local values before ISO normalization. Local-only (non-synced). Rollback: UPDATE running_hours_audit r SET date_updated_local = b.old_text FROM rh_date_normalization_backup b WHERE r.rhauuid = b.rhauuid AND b.migration_version = ''167'' AND r.date_updated_local = b.new_text. Retention: keep until fleet-wide convergence is verified, then may be truncated.';

-- (d) Normalize every parseable non-ISO row to YYYY-MM-DD, backing up originals first.
--     Idempotent: a second run finds no non-ISO parseable rows (already rewritten),
--     and the backup insert is ON CONFLICT DO NOTHING (first-run original preserved).
DO $$
BEGIN
  WITH candidates AS (
    SELECT rhauuid,
           date_updated_local AS old_text,
           TO_CHAR(safe_rh_reading_day(date_updated_local), 'YYYY-MM-DD') AS new_text
      FROM running_hours_audit
     WHERE date_updated_local IS NOT NULL
       AND date_updated_local !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
       AND safe_rh_reading_day(date_updated_local) IS NOT NULL
  ),
  backed_up AS (
    INSERT INTO rh_date_normalization_backup (rhauuid, old_text, new_text, migration_version)
    SELECT rhauuid, old_text, new_text, '167' FROM candidates
    ON CONFLICT (rhauuid, migration_version) DO NOTHING
    RETURNING rhauuid
  )
  UPDATE running_hours_audit r
     SET date_updated_local = c.new_text
    FROM candidates c
   WHERE r.rhauuid = c.rhauuid;

  RAISE NOTICE 'Task #427: date_updated_local normalization complete';
END $$;

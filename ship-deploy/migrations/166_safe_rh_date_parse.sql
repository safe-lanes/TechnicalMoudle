-- Task #424: crash-proof parse of running_hours_audit.date_updated_local.
-- The column is free text (sync copies it verbatim), so legacy rows can contain
-- "Sept"/"June"/"July"/full month names or outright garbage ("15 Sep 2025 99:99",
-- "2025-13-40"). TO_TIMESTAMP raises 22007/22008 on such values and a single bad
-- row aborts any batched query — breaking the RH module for the whole vessel.
-- This function normalizes long month names to 3 letters and converts ANY parse
-- failure to NULL so the row is simply excluded from date matching.
-- Idempotent: CREATE OR REPLACE.
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

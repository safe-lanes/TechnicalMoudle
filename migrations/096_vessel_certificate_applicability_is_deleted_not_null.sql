-- Mirrors migration 094 for the certificate side. Eliminate NULL/false
-- split-brain on vessel_certificate_applicability.is_deleted. The read paths
-- treat NULL as "live", but the partial unique index from 095 only constrains
-- rows with is_deleted = false. Normalize NULLs to false and enforce NOT NULL
-- so live-row semantics are unambiguous and the index covers every live row.

UPDATE vessel_certificate_applicability SET is_deleted = false WHERE is_deleted IS NULL;
ALTER TABLE vessel_certificate_applicability ALTER COLUMN is_deleted SET DEFAULT false;
ALTER TABLE vessel_certificate_applicability ALTER COLUMN is_deleted SET NOT NULL;

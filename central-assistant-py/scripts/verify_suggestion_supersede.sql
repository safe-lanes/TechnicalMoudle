-- Rolled-back proof on the PILOT DB: a supersede hides the section; without it the section is present.
BEGIN;
CREATE TEMP VIEW q AS
  SELECT file, section_title FROM assistant_chunks c WHERE c.index_set='kb-xref-e' AND lower(c.module)='crewing'
  AND c.kb_state IS NULL AND c.tenant_domain IS NULL GROUP BY file, section_title
  HAVING bool_and(NOT EXISTS (SELECT 1 FROM kb_supersedes x WHERE x.index_set = c.index_set AND x.chunk_id = c.id));
SELECT 'before', count(*) FILTER (WHERE section_title LIKE '1.2.1.3 HOW TO CREATE A NEW CREW RECORD%') AS crew_record_present, count(*) AS sections FROM q;
INSERT INTO kb_supersedes (entry_id, index_set, chunk_id, tenant_domain, env_scope)
  SELECT (SELECT id FROM kb_entries LIMIT 1), 'kb-xref-e', id, NULL, '*' FROM assistant_chunks
  WHERE index_set='kb-xref-e' AND lower(module)='crewing' AND kb_state IS NULL AND section_title LIKE '1.2.1.3 HOW TO CREATE A NEW CREW RECORD%' LIMIT 1;
SELECT 'after supersede', count(*) FILTER (WHERE section_title LIKE '1.2.1.3 HOW TO CREATE A NEW CREW RECORD%'), count(*) FROM q;
ROLLBACK;

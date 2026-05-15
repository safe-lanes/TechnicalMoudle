-- Task #138 cleanup (2026-05-15): the trailing one-off INSERT block that
-- backfilled A1-003, A1-004, A1-006 was removed after a precondition audit
-- confirmed all 71 starter-kit master_ids already exist on every reachable
-- environment. Audit evidence and post-edit idempotency verification are
-- recorded in docs/cert-master-audit-task-138.md.
--
-- Cross-environment audit summary (2026-05-15):
--   * DEV (this Repl)         : 71/71 present, 71 is_system_defined=true,
--                               71 is_deleted=false, 0 missing IDs.
--                               Re-run of the surviving UPDATE returned 0
--                               rows, confirming idempotency.
--   * Production / fork DBs   : NOT directly reachable from this Repl.
--                               Migration 080 was already recorded in
--                               schema_migrations on those environments
--                               (per the original Task #35 deployment), so
--                               this source edit cannot trigger any new SQL
--                               execution there. Operators must re-run the
--                               same audit query (see docs file) on each
--                               environment that has not yet applied 080
--                               BEFORE deploying this change.
--
-- The surviving UPDATE below is fully idempotent (the AND is_system_defined
-- = false predicate guarantees zero rows on a second run).

UPDATE ship_certificates_master
SET is_system_defined = true
WHERE master_id IN (
  'A1-001','A1-002','A1-003','A1-004','A1-005','A1-006','A1-007','A1-008','A1-009',
  'A1-010','A1-011','A1-012','A1-013','A1-014','A1-015','A1-016','A1-017','A1-018',
  'A1-019','A1-020','A1-021','A1-022','A1-023','A1-024','A1-025','A1-026','A1-027',
  'A1-028','A1-029','A1-030','A1-031','A1-032','A1-033','A1-034','A1-035','A1-036',
  'A1-037','A1-038','A1-039','A1-040','A1-041','A1-042','A1-043','A1-044','A1-045',
  'A1-046','A1-047','A1-048','A1-049',
  'A2-001','A2-002',
  'A3-001',
  'A4-001','A4-002','A4-003',
  'A5-001','A5-002',
  'A6-001',
  'A7-001','A7-002',
  'A8-001','A8-002',
  'A9-001','A9-002','A9-003','A9-004','A9-005',
  'B10-001','B10-002','B10-003','B10-004'
)
AND is_system_defined = false;

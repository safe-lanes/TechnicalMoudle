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

INSERT INTO ship_certificates_master (master_id, certificate_name, category, "group", requirement_ref, applicable_to_company, certificate_label, is_active, is_system_defined, is_deleted, sequence)
SELECT v.master_id, v.certificate_name, v.category, v.grp, v.requirement_ref, false, '', true, true, false, v.seq
FROM (VALUES
  ('A1-003', 'International Tonnage Certificate (1969)', 'A', '1', 'Tonnage 1969, Article 7', 3),
  ('A1-004', 'International Load Line Certificate', 'A', '1', 'LL 1966, Article 16; LL PROT 1988, Article 16', 4),
  ('A1-006', 'Load Line 1966 - Conditions of Freeboard Assignment', 'A', '1', 'LL 1966, Article 16; LL PROT 1988, Article 16', 6)
) AS v(master_id, certificate_name, category, grp, requirement_ref, seq)
WHERE NOT EXISTS (
  SELECT 1 FROM ship_certificates_master scm WHERE scm.master_id = v.master_id
);

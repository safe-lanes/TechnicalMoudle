import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface CertificatePagingFilters {
  vesselId?: string;
  vesselIds?: string[];
  vesselName?: string;
  vesselNames?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

const textSorts = new Set([
  'id', 'companyId', 'certificateName', 'name', 'vessel', 'certificateNumber',
  'type', 'companyGroup', 'issueDate', 'expiryDate', 'lastAnnual', 'nextAnnual',
  'lastInterm', 'nextInterm', 'endorsementDate',
]);

export function supportsSqlCertificateSort(sortBy?: string) {
  return !sortBy || !textSorts.has(sortBy);
}

// ECMAScript trim whitespace, rather than PostgreSQL btrim's space-only default.
const trimCharacters = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680'
  + '\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a'
  + '\u2028\u2029\u202f\u205f\u3000\ufeff';

function scope(filters: CertificatePagingFilters) {
  if (filters.vesselId && filters.vesselId !== 'all') {
    return sql`a.vessel_id = ${filters.vesselId}`;
  }
  if (filters.vesselId === 'all' && filters.vesselIds?.length) {
    return sql`a.vessel_id = ANY(${sql.param(filters.vesselIds)}::text[])`;
  }
  // Existing ICU root collation supplies Unicode-aware lowercasing only.
  // It is NOT substituted for JavaScript's natural string-sort comparator.
  const name = sql`lower(btrim(a.vessel_name, ${trimCharacters}) COLLATE "unicode")`;
  if (filters.vesselName) {
    return sql`${name} = ${filters.vesselName.toLowerCase().trim()}`;
  }
  if (filters.vesselNames) {
    const names = filters.vesselNames.split(',').map(value => value.toLowerCase().trim());
    return sql`${name} = ANY(${sql.param(names)}::text[])`;
  }
  return sql`true`;
}

function eligibility(filters: CertificatePagingFilters) {
  return sql`
    applicability_source AS MATERIALIZED (
      SELECT a.*, row_number() OVER () AS source_order
      FROM vessel_certificate_applicability a
      WHERE a.is_applicable = true AND (a.is_deleted = false OR a.is_deleted IS NULL)
    ),
    scoped AS MATERIALIZED (
      SELECT a.*, min(a.source_order) OVER (PARTITION BY a.vessel_id) AS vessel_order
      FROM applicability_source a WHERE ${scope(filters)}
    ),
    eligible AS MATERIALIZED (
      SELECT a.vessel_id, a.vessel_name, a.master_id, a.source_order, a.vessel_order,
        m.company_id, m.certificate_label, m.certificate_name, m.company_group,
        coalesce(m.company_sequence, m.sequence, 9999) AS effective_sequence
      FROM scoped a
      JOIN ship_certificates_master m ON m.master_id = a.master_id
      WHERE m.is_active = true AND (m.is_deleted = false OR m.is_deleted IS NULL)
    )
  `;
}

/**
 * Database scope/count/page selection for default and numeric ordering.
 * No application-side candidate array, rank list or attachment-wide read.
 * Source encounter order is retained, not replaced with an ID tie-breaker.
 */
export async function queryNumericCertificatePage(
  db: Pick<NodePgDatabase, 'execute'>, filters: CertificatePagingFilters,
) {
  if (!supportsSqlCertificateSort(filters.sortBy)) {
    throw new Error('Natural text sorting is not supported by this SQL paging path');
  }
  const page = filters.page || 1;
  const limit = filters.limit || 100;
  const sortOrder = filters.sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';
  const common = eligibility(filters);
  const counts = await db.execute(sql`
    WITH ${common}
    SELECT count(*)::int AS total,
      (SELECT count(*)::int FROM scoped) AS scoped_total FROM eligible
  `);
  const total = Number(counts.rows[0].total);
  if (Number(counts.rows[0].scoped_total) === 0) {
    return { certificates: [], total: 0, page, limit };
  }

  // Preserve the previous slice window, including negative legacy inputs.
  const offset = (page - 1) * limit;
  const index = (value: number) => value < 0
    ? Math.max(total + value, 0) : Math.min(value, total);
  const start = index(offset);
  const length = Math.max(index(offset + limit) - start, 0);
  const baseOrder = sql`p.vessel_order ASC, p.effective_sequence ASC, p.source_order ASC`;
  const order = filters.sortBy
    ? sql`p.effective_sequence ${sql.raw(sortOrder === 'desc' ? 'DESC' : 'ASC')}, ${baseOrder}`
    : baseOrder;
  const rows = await db.execute(sql`
    WITH ${common},
    page AS MATERIALIZED (
      SELECT p.* FROM eligible p ORDER BY ${order} LIMIT ${length} OFFSET ${start}
    ),
    data_source AS MATERIALIZED (
      SELECT d.id, d.vessel_id || '-' || d.master_id AS data_key,
        row_number() OVER () AS source_order
      FROM vessel_certificate_data d
      WHERE d.is_deleted = false OR d.is_deleted IS NULL
    )
    SELECT
      coalesce(nullif(p.company_id, ''), p.master_id) AS id,
      coalesce(nullif(p.certificate_label, ''), p.certificate_name) AS "certificateName",
      coalesce(p.company_group, '') AS type,
      p.vessel_name AS vessel, p.vessel_id AS "vesselId", p.master_id AS "masterId",
      p.effective_sequence AS "companySequence",
      coalesce(d.certificate_number, '') AS "certificateNumber",
      coalesce(d.issue_date, '') AS "issueDate", coalesce(d.expiry_date, '') AS "expiryDate",
      coalesce(d.last_annual, '') AS "lastAnnual", coalesce(d.next_annual, '') AS "nextAnnual",
      coalesce(d.last_interm, '') AS "lastInterm", coalesce(d.next_interm, '') AS "nextInterm",
      coalesce(d.endorsement_date, '') AS "endorsementDate",
      coalesce(d.last_edit_upload, '') AS "lastEditUpload", d.attachments
    FROM page p
    LEFT JOIN LATERAL (
      SELECT source.id FROM data_source source
      WHERE source.data_key = p.vessel_id || '-' || p.master_id
      ORDER BY source.source_order DESC LIMIT 1
    ) selected_data ON true
    LEFT JOIN vessel_certificate_data d ON d.id = selected_data.id
    ORDER BY ${order}
  `);
  return {
    certificates: rows.rows.map(row => ({ ...row, attachments: row.attachments || [] })),
    total, page, limit, totalPages: Math.ceil(total / limit),
    sortBy: filters.sortBy || 'companySequence', sortOrder,
  };
}

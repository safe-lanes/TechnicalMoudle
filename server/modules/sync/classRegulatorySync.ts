import type { Pool } from "pg";

export const CLASS_REGULATORY_CAPABILITY = "component_class_regulatory_uuid_v1";
export const CLASS_REGULATORY_REQUIRED_COLUMNS = [
  "ccruuid", "classification_society_key", "survey_type_key", "deleted_by_uuid", "deleted_at",
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Full row transport, UUID only. No natural-key fallback, receiver clock or field-log echo. */
export async function applyClassRegulatoryRows(pool: Pool, rows: any[], columns: Set<string>) {
  if (CLASS_REGULATORY_REQUIRED_COLUMNS.some(column => !columns.has(column))) {
    throw new Error("Section H receiver schema is not ready; apply migrations 185–187 before retrying.");
  }
  const result = { inserted: 0, updated: 0, softDeleted: 0, silentNoOps: 0, errors: [] as Array<{ rowIndex: number; error: string }> };
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    await conn.query("SET LOCAL sync.bypass_trigger = 'true'");
    const unresolved = await conn.query("SELECT 1 FROM component_class_regulatory WHERE ccruuid IS NULL LIMIT 1");
    if (unresolved.rows.length) throw new Error("Historical Section H UUID reconciliation is required before receiving updates.");
    for (const incoming of rows) {
      const row = Object.fromEntries(Object.entries(incoming).map(([key, value]) =>
        [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), value]));
      if (!uuid.test(String(row.ccruuid || ""))) throw new Error("Section H payload has no valid UUID; old payloads cannot be matched safely.");
      for (const field of ["component_id", "component_code", "vessel_code", "classification_society", "survey_type", "created_by", "created_at", "updated_at"]) {
        if (row[field] === undefined || row[field] === null) throw new Error(`Section H snapshot is incomplete: ${field}.`);
      }
      const parents = await conn.query(
        `SELECT c.cuuid FROM components c JOIN vessels v ON v.vuuid = c.vessel_id
         WHERE c.cuuid = $1 AND (v.code = $2 OR v.id = $2)`, [row.component_id, row.vessel_code]);
      if (!parents.rows.length) throw new Error("Section H component/vessel dependency is missing or inconsistent.");
      for (const [field, type] of [["classification_society_key", "classificationSociety"], ["survey_type_key", "surveyType"]]) {
        if (row[field] != null) {
          const found = await conn.query("SELECT 1 FROM master_lists WHERE list_type = $1 AND list_key = $2", [type, row[field]]);
          if (!found.rows.length) throw new Error("Section H master dependency is missing; deliver masters first.");
        }
      }
      const existing = await conn.query(
        "SELECT component_id, vessel_code FROM component_class_regulatory WHERE ccruuid = $1 FOR UPDATE", [row.ccruuid]);
      if (existing.rows.length && (existing.rows[0].component_id !== row.component_id || existing.rows[0].vessel_code !== row.vessel_code)) {
        throw new Error("Section H UUID ownership cannot be changed.");
      }
      const keys = Object.keys(row).filter(key => columns.has(key) && key !== "id" && key !== "ccruuid");
      const values = keys.map(key => row[key]);
      if (existing.rows.length) {
        // Guard ordering in PostgreSQL to retain full timestamp precision.
        const stampIndex = keys.indexOf("updated_at") + 1;
        await conn.query(`UPDATE component_class_regulatory SET ${keys.map((key, i) => `"${key}" = $${i + 1}`).join(", ")}
          WHERE ccruuid = $${values.length + 1} AND updated_at <= $${stampIndex}::timestamp`, [...values, row.ccruuid]);
        if (row.is_deleted === true) result.softDeleted++; else result.updated++;
      } else {
        const inserted = await conn.query(`INSERT INTO component_class_regulatory
          (ccruuid, ${keys.map(key => `"${key}"`).join(", ")})
          VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(", ")}) ON CONFLICT DO NOTHING RETURNING ccruuid`,
        [row.ccruuid, ...values]);
        if (!inserted.rows.length) throw new Error("Section H insertion conflicted; delivery has not been acknowledged.");
        result.inserted++;
      }
    }
    await conn.query("COMMIT");
    return result;
  } catch (error) {
    await conn.query("ROLLBACK");
    throw error;
  } finally {
    conn.release();
  }
}

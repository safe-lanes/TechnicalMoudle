import type { Pool } from "pg";
import { SECTION_H_ATTACHMENT_TABLE as TABLE, SECTION_H_FILE_BYTES, SECTION_H_TYPES, SECTION_H_UUID, sectionHFileKey } from "@shared/sectionHAttachments";
export const ATTACHMENT_COLUMNS = [
  "ccrauuid", "class_regulatory_uuid", "component_id", "vessel_id", "original_filename",
  "file_key", "content_type", "file_size", "storage_backend", "uploaded_by_uuid", "uploaded_by",
  "uploaded_at", "created_at", "updated_at", "created_by", "updated_by", "created_by_uuid",
  "updated_by_uuid", "is_deleted", "deleted_at", "deleted_by_uuid", "is_sync", "sort_order",
];
export function validateAttachmentSnapshot(row: Record<string, any>) {
  for (const key of ATTACHMENT_COLUMNS.filter(k => !["deleted_at", "deleted_by_uuid", "sort_order"].includes(k))) {
    if (row[key] === null || row[key] === undefined) throw new Error(`Incomplete Section H attachment: ${key}.`);
  }
  if (![row.ccrauuid, row.class_regulatory_uuid, row.component_id, row.vessel_id].every(v => SECTION_H_UUID.test(v)))
    throw new Error("Section H attachment has invalid canonical ownership.");
  if (sectionHFileKey(row.vessel_id, row.class_regulatory_uuid, row.ccrauuid, row.original_filename) !== row.file_key)
    throw new Error("Section H attachment path does not match its owner.");
  const extension = String(row.original_filename).split(".").pop()?.toLowerCase() || "";
  if (SECTION_H_TYPES[extension] !== row.content_type || !["local", "object"].includes(row.storage_backend) ||
      !Number.isSafeInteger(row.file_size) || row.file_size <= 0 || row.file_size > SECTION_H_FILE_BYTES)
    throw new Error("Invalid Section H attachment file metadata.");
  if (typeof row.is_deleted !== "boolean" || (row.is_deleted ? !row.deleted_at || !row.deleted_by_uuid : row.deleted_at != null || row.deleted_by_uuid != null))
    throw new Error("Invalid Section H attachment lifecycle.");
  if (!["updated_at", "created_at", "uploaded_at"].every(k => Number.isFinite(new Date(row[k]).getTime())))
    throw new Error("Invalid Section H attachment timestamps.");
}
/** Authoritative full snapshots only; preserve sender clock and never natural-key match. */
export async function applySectionHAttachmentRows(pool: Pool, rows: any[], columns: Set<string>, expectedVessel?: string) {
  if (ATTACHMENT_COLUMNS.some(k => !columns.has(k))) throw new Error("Apply migration 190 before receiving Section H attachments.");
  const result = { inserted: 0, updated: 0, softDeleted: 0, silentNoOps: 0, errors: [] as Array<{ rowIndex: number; error: string }> };
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    await conn.query("SET LOCAL sync.bypass_trigger = 'true'");
    for (const input of rows) {
      const row = Object.fromEntries(Object.entries(input).map(([k, v]) => [k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), v]));
      validateAttachmentSnapshot(row);
      if (expectedVessel && row.vessel_id !== expectedVessel) throw new Error("Section H attachment is outside this synchronization vessel scope.");
      const parent = await conn.query(`SELECT e.ccruuid FROM component_class_regulatory e
        JOIN components c ON c.cuuid=e.component_id JOIN vessels v ON v.vuuid=c.vessel_id
        WHERE e.ccruuid=$1 AND c.cuuid=$2 AND v.vuuid=$3 AND (e.vessel_code=v.code OR e.vessel_code=v.id)`,
      [row.class_regulatory_uuid, row.component_id, row.vessel_id]);
      if (!parent.rows.length) throw new Error("Section H attachment parent/vessel dependency is missing or inconsistent.");
      const old = await conn.query(`SELECT * FROM ${TABLE} WHERE ccrauuid=$1 FOR UPDATE`, [row.ccrauuid]);
      if (old.rows.length) {
        for (const key of ["class_regulatory_uuid", "component_id", "vessel_id", "file_key", "file_size", "content_type", "original_filename", "uploaded_by_uuid"]) {
          if (old.rows[0][key] !== row[key]) throw new Error("Section H attachment identity/content cannot be replaced.");
        }
        const keys = ATTACHMENT_COLUMNS.filter(k => !["ccrauuid", "storage_backend"].includes(k));
        const applied = await conn.query(`UPDATE ${TABLE} SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(",")}
          WHERE ccrauuid=$${keys.length + 1} AND updated_at <= $${keys.indexOf("updated_at") + 1}::timestamp RETURNING ccrauuid`,
        [...keys.map(k => row[k]), row.ccrauuid]);
        if (!applied.rows.length) result.silentNoOps++;
        else if (row.is_deleted) result.softDeleted++;
        else result.updated++;
      } else {
        // Receiver-local storage is always private local bytes; sender backend is not a path instruction.
        row.storage_backend = "local";
        await conn.query(`INSERT INTO ${TABLE} (${ATTACHMENT_COLUMNS.map(k => `"${k}"`).join(",")})
          VALUES (${ATTACHMENT_COLUMNS.map((_, i) => `$${i + 1}`).join(",")})`, ATTACHMENT_COLUMNS.map(k => row[k]));
        result.inserted++;
      }
    }
    await conn.query("COMMIT"); return result;
  } catch (error) { await conn.query("ROLLBACK"); throw error; }
  finally { conn.release(); }
}

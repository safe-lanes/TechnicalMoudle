import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getPool } from "../../db";
import { SECTION_H_ATTACHMENT_TABLE, SECTION_H_FILE_BYTES, SECTION_H_UUID, sectionHFileKey } from "@shared/sectionHAttachments";
import { readSectionHFile, sectionHLocalPath } from "../components/services/sectionHAttachmentStorage";

/** Bind every queue/key lookup to the canonical metadata and parent owner, not a supplied path. */
export async function sectionHTransferOwner(key: string, vesselId: string | null, size?: number | null) {
  if (!vesselId || !SECTION_H_UUID.test(vesselId)) throw new Error("Section H file transfer has no canonical vessel.");
  const pool = await getPool();
  const found = await pool.query(`SELECT a.* FROM component_class_regulatory_attachments a
    JOIN component_class_regulatory e ON e.ccruuid=a.class_regulatory_uuid
    JOIN components c ON c.cuuid=e.component_id JOIN vessels v ON v.vuuid=c.vessel_id
    WHERE a.file_key=$1 AND a.vessel_id=$2 AND a.component_id=c.cuuid AND a.vessel_id=v.vuuid
      AND (e.vessel_code=v.code OR e.vessel_code=v.id)`, [key, vesselId]);
  const row = found.rows[0];
  if (!row || row.file_key !== sectionHFileKey(row.vessel_id, row.class_regulatory_uuid, row.ccrauuid, row.original_filename) ||
      row.file_size <= 0 || row.file_size > SECTION_H_FILE_BYTES || (size != null && row.file_size !== size))
    throw new Error("Section H file metadata is missing or inconsistent; deliver parent and metadata first.");
  return row;
}
/** Object sources are materialized privately for existing bounded chunk reads; other file entities unchanged. */
export async function sectionHTransferPath(key: string, vessel: string | null, size?: number | null) {
  const row = await sectionHTransferOwner(key, vessel, size);
  const target = sectionHLocalPath(key);
  try {
    const stat = await fs.stat(target);
    if (stat.size !== row.file_size) throw new Error("Section H local file size mismatch.");
    return target;
  } catch (error: any) { if (error.code !== "ENOENT") throw error; }
  const bytes = await readSectionHFile(key, row.storage_backend);
  if (bytes.length !== row.file_size) throw new Error("Section H object file size mismatch.");
  await fs.mkdir(path.dirname(target), { recursive: true });
  // Atomic local cache; complete bytes only are visible to chunk readers.
  const staging = `${target}.${randomUUID()}.staging`;
  try { await fs.writeFile(staging, bytes, { flag: "wx" }); await fs.rename(staging, target); }
  finally { await fs.unlink(staging).catch(() => {}); }
  return target;
}
export { SECTION_H_ATTACHMENT_TABLE };

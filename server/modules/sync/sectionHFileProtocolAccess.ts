import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { getPool } from "../../db";
import { tenantConnectionManager } from "../../utils/tenantConnectionManager";
import * as repo from "./repository";
import { SECTION_H_ATTACHMENT_TABLE } from "@shared/sectionHAttachments";

/** Existing tenant guard authenticates multi-tenant peers. Single-tenant Section H also fails closed. */
export async function assertSectionHFilePeer(req: Request, vesselId: string | null) {
  const instance = String(req.headers["x-sync-instance-id"] || "");
  if (!instance.toUpperCase().startsWith("SHIP-") || !vesselId)
    throw Object.assign(new Error("A registered vessel sync peer is required."), { statusCode: 403 });
  if (!tenantConnectionManager.isMultiTenantEnabled) {
    const expected = await repo.getSetting("sync_api_key") || process.env.SYNC_API_KEY || "";
    const provided = String(req.headers["x-sync-api-key"] || "");
    if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(provided) ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(provided)))
      throw Object.assign(new Error("Section H sync peer authentication failed."), { statusCode: 403 });
  }
  const pool = await getPool();
  const match = await pool.query("SELECT 1 FROM vessels WHERE vuuid=$1 AND (upper(code)=upper($2) OR upper(id)=upper($2)) AND is_deleted IS NOT TRUE",
    [vesselId, instance.substring(5)]);
  if (!match.rows.length) throw Object.assign(new Error("Sync peer cannot access this vessel's Section H files."), { statusCode: 403 });
}
export async function assertSectionHQueuePeer(req: Request, queueUuid: string) {
  const entry = await repo.getFileQueueEntry(queueUuid);
  if (entry?.tableName === SECTION_H_ATTACHMENT_TABLE) {
    if (entry.direction !== "shore_to_ship") throw Object.assign(new Error("Invalid Section H transfer direction."), { statusCode: 403 });
    await assertSectionHFilePeer(req, entry.vesselId);
  }
}

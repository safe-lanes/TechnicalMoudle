import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { auditLog, componentClassRegulatory as entries, componentClassRegulatoryAttachments as files, syncFileQueue, masterUsers, components } from "@shared/schema";
import type { SectionHAttachment } from "@shared/schema";
import { assertAttachmentQuota, SECTION_H_ATTACHMENT_TABLE, SECTION_H_UUID, sectionHFileKey } from "@shared/sectionHAttachments";
import { getDb } from "../../../db";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors";
import { sectionHOfficeCanManage, type SectionHActor } from "./classRegulatoryAccess";
import { parent } from "./classRegulatoryService";
import { isShipInstance, getEffectiveInstanceId } from "../../sync/syncRole";
import { createDefaultDevelopmentUser } from "@shared/developmentUser";
import { validateSectionHUpload } from "./sectionHAttachmentValidation";
import * as storage from "./sectionHAttachmentStorage";

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
async function owner(db: Db | Tx, entryUuid: string, actor: SectionHActor, lock = false, allowRemoved = false) {
  if (!SECTION_H_UUID.test(entryUuid)) throw new ValidationError("Save the entry with a canonical identity before attaching files.");
  const q = db.select().from(entries).where(eq(entries.ccruuid, entryUuid)).limit(1);
  const [entry] = lock ? await q.for("update") : await q;
  if (!entry || (entry.isDeleted && !allowRemoved)) throw new NotFoundError("Active classification entry not found.");
  if (lock) await db.select({ id: components.cuuid }).from(components).where(eq(components.cuuid, entry.componentId)).for("update");
  const result = await parent(db, entry.componentId, actor);
  return { ...result, entry };
}
async function requireWrite(actor: SectionHActor) {
  if (!sectionHOfficeCanManage(actor)) throw new ForbiddenError("Only Office users can manage attachments.");
  if (await isShipInstance()) throw new ForbiddenError("Attachments are managed on shore and delivered to vessels by synchronization.");
}
function safeFile(row: SectionHAttachment, available: boolean) {
  return {
    ccrauuid: row.ccrauuid, originalFilename: row.originalFilename, contentType: row.contentType,
    fileSize: row.fileSize, uploadedByUuid: row.uploadedByUuid, uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt, isDeleted: row.isDeleted, deletedAt: row.deletedAt,
    deletedByUuid: row.deletedByUuid, availability: available ? "available" : "pending",
  };
}
async function quota(tx: Tx, entryUuid: string, size: number) {
  const active = await tx.select({ size: files.fileSize }).from(files)
    .where(and(eq(files.classRegulatoryUuid, entryUuid), eq(files.isDeleted, false)));
  try { assertAttachmentQuota(active.length, active.reduce((sum, f) => sum + f.size, 0), size); }
  catch (error: any) { throw new ConflictError(error.message); }
}
async function label(actor: SectionHActor) {
  if (actor.identityMode === "replit-default") {
    const user = createDefaultDevelopmentUser(); return user.fullName || user.username;
  }
  const db = await getDb();
  const [user] = await db.select({ fullName: masterUsers.fullName }).from(masterUsers).where(eq(masterUsers.id, actor.userId)).limit(1);
  return user?.fullName || actor.userId;
}
async function audit(tx: Tx, actor: SectionHActor, action: string, row: SectionHAttachment, before?: SectionHAttachment) {
  await tx.insert(auditLog).values({
    userId: actor.userId, entityType: SECTION_H_ATTACHMENT_TABLE, entityId: row.ccrauuid,
    actionType: action, oldValue: before ? JSON.stringify(before) : null, newValue: JSON.stringify(row),
    createdByUuid: actor.userId, updatedByUuid: actor.userId, source: "web_ui",
    payload: { entryUuid: row.classRegulatoryUuid, componentUuid: row.componentId, vesselUuid: row.vesselId },
  });
}
/** Durable intent in the SAME transaction as the new file; no best-effort queue gap. */
async function queue(tx: Tx, row: SectionHAttachment, instanceId: string, hash: string) {
  await tx.insert(syncFileQueue).values({
    queueUuid: randomUUID(), tableName: SECTION_H_ATTACHMENT_TABLE, rowUuid: row.ccrauuid,
    fileKey: row.fileKey, fileName: row.originalFilename, fileSizeBytes: row.fileSize, fileHash: hash,
    direction: "shore_to_ship", vesselId: row.vesselId, instanceId, status: "pending",
    totalChunks: Math.ceil(row.fileSize / (256 * 1024)), priority: row.fileSize < 100 * 1024 ? 10 : 0,
  });
}
export async function list(entryUuid: string, actor: SectionHActor, includeDeleted: boolean) {
  if (includeDeleted && !sectionHOfficeCanManage(actor)) throw new ForbiddenError("Office access is required to view removed files.");
  const db = await getDb();
  const { entry } = await owner(db, entryUuid, actor, false, includeDeleted);
  const rows = await db.select().from(files).where(and(eq(files.classRegulatoryUuid, entryUuid),
    includeDeleted ? undefined : eq(files.isDeleted, false))).orderBy(asc(files.uploadedAt), asc(files.ccrauuid));
  const active = rows.filter(row => !row.isDeleted);
  return {
    files: await Promise.all(rows.map(async row => safeFile(row, !entry.isDeleted && !row.isDeleted && await storage.sectionHFileAvailable(row.fileKey, row.storageBackend)))),
    activeCount: active.length, activeBytes: active.reduce((sum, row) => sum + row.fileSize, 0),
  };
}
export async function upload(entryUuid: string, attachmentUuid: string, file: Express.Multer.File, actor: SectionHActor) {
  await requireWrite(actor);
  if (!SECTION_H_UUID.test(attachmentUuid)) throw new ValidationError("A valid upload retry identity is required.");
  if (!file) throw new ValidationError("Choose a file to attach.");
  const { name, contentType } = await validateSectionHUpload(file);
  const db = await getDb();
  const actorLabel = await label(actor), instanceId = await getEffectiveInstanceId();
  const hash = createHash("sha256").update(file.buffer).digest("hex");
  let staged: { key: string; backend: string } | undefined;
  try { return await db.transaction(async tx => {
    const { component, vessel } = await owner(tx, entryUuid, actor, true);
    const [existing] = await tx.select().from(files).where(eq(files.ccrauuid, attachmentUuid));
    if (existing) {
      if (existing.classRegulatoryUuid !== entryUuid || existing.vesselId !== vessel.vuuid ||
          existing.originalFilename !== name || existing.fileSize !== file.size || existing.isDeleted)
        throw new ConflictError("This upload identity was already used for a different attachment.");
      const bytes = await storage.readSectionHFile(existing.fileKey, existing.storageBackend);
      if (createHash("sha256").update(bytes).digest("hex") !== hash) throw new ConflictError("Upload retry content differs from the original file.");
      return safeFile(existing, true);
    }
    await quota(tx, entryUuid, file.size);
    const backend = storage.sectionHStorageBackend();
    const key = sectionHFileKey(vessel.vuuid, entryUuid, attachmentUuid, name);
    await storage.writeSectionHFile(key, file.buffer, backend, contentType);
    staged = { key, backend };
    try {
      const [row] = await tx.insert(files).values({
        ccrauuid: attachmentUuid, classRegulatoryUuid: entryUuid, componentId: component.cuuid,
        vesselId: vessel.vuuid, originalFilename: name, fileKey: key, contentType, fileSize: file.size,
        storageBackend: backend, uploadedByUuid: actor.userId, uploadedBy: actorLabel,
        createdBy: actorLabel, updatedBy: actorLabel, createdByUuid: actor.userId, updatedByUuid: actor.userId,
        updatedAt: new Date(),
      }).returning();
      await audit(tx, actor, "create", row);
      await queue(tx, row, instanceId, hash);
      return safeFile(row, true);
    } catch (error) {
      await storage.discardSectionHFile(key, backend).catch(cleanup => console.error("[Section H attachments] staged cleanup failed", cleanup));
      throw error;
    }
  }); } catch (error) {
    if (staged) await storage.discardSectionHFile(staged.key, staged.backend)
      .catch(cleanup => console.error("[Section H attachments] transaction rollback cleanup failed", cleanup));
    throw error;
  }
}
export async function mutate(entryUuid: string, uuid: string, restore: boolean, actor: SectionHActor) {
  await requireWrite(actor);
  const db = await getDb(), actorLabel = await label(actor), instanceId = await getEffectiveInstanceId();
  return db.transaction(async tx => {
    await owner(tx, entryUuid, actor, true);
    const [row] = await tx.select().from(files).where(and(eq(files.ccrauuid, uuid), eq(files.classRegulatoryUuid, entryUuid))).for("update");
    if (!row) throw new NotFoundError("Attachment not found on this entry.");
    if (row.isDeleted === !restore) return safeFile(row, !row.isDeleted);
    let hash: string | undefined;
    if (restore) {
      await quota(tx, entryUuid, row.fileSize);
      let bytes: Buffer;
      try { bytes = await storage.readSectionHFile(row.fileKey, row.storageBackend); }
      catch { throw new ConflictError("The retained file is unavailable. Restore its storage before retrying."); }
      if (bytes.length !== row.fileSize) throw new ConflictError("The retained file size does not match its record.");
      hash = createHash("sha256").update(bytes).digest("hex");
    }
    const now = new Date();
    const [saved] = await tx.update(files).set({
      isDeleted: !restore, deletedAt: restore ? null : now, deletedByUuid: restore ? null : actor.userId,
      updatedAt: now, updatedBy: actorLabel, updatedByUuid: actor.userId, isSync: false,
    }).where(eq(files.ccrauuid, uuid)).returning();
    await audit(tx, actor, restore ? "restore" : "delete", saved, row);
    if (restore) await queue(tx, saved, instanceId, hash!);
    return safeFile(saved, restore);
  });
}
export async function download(entryUuid: string, uuid: string, actor: SectionHActor) {
  const db = await getDb();
  await owner(db, entryUuid, actor);
  const [row] = await db.select().from(files).where(and(eq(files.ccrauuid, uuid), eq(files.classRegulatoryUuid, entryUuid), eq(files.isDeleted, false)));
  if (!row) throw new NotFoundError("Attachment not found.");
  try {
    const bytes = await storage.readSectionHFile(row.fileKey, row.storageBackend);
    if (bytes.length !== row.fileSize) throw new Error("Invalid stored size.");
    return { bytes, name: row.originalFilename, type: row.contentType };
  } catch { throw new AppError(409, "Attachment bytes are unavailable or pending delivery. Retry after synchronization."); }
}

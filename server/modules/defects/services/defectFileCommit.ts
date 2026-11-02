import { isDeepStrictEqual } from 'node:util';
import { and, eq, sql } from 'drizzle-orm';
import { defects, auditLog, syncFileQueue } from '@shared/schema';
import { DEFECT_SECTION_FIELDS, isExternalDefectAttachment, UUID } from '@shared/defectAttachments';
import { getDb } from '../../../db';
import { defectFileCommitContext } from './defectFileContext';
import { assertDefectFileAccess, fileError, type DefectFileActor } from './defectFileAccess';
import { readStagedDefectFile, stagingNamespace, type StagedDefectFile } from './defectFileStaging';
import { defectFileStore, fileHash } from './defectFileStorage';
import { getDefectFileReadiness } from './defectFileReadiness';
import { getEffectiveInstanceId, isShipInstance } from '../../sync/syncRole';

export function hasExternalDefectFiles(body: any) {
  return Object.values(DEFECT_SECTION_FIELDS).some(field =>
    Array.isArray(body?.[field]) && body[field].some(isExternalDefectAttachment));
}
/**
 * File bytes are copied before the business transaction commits; staging stays
 * recoverable for seven days. The DB transaction owns metadata, audit, field logs
 * and queue intent. A failed DB commit never deletes previously saved files.
 */
export async function withDefectFileSave<T>(body: any, current: any, actor: DefectFileActor | undefined,
  work: (body: any) => Promise<T>, revalidate: (locked: any, body: any) => Promise<void>) {
  const pairs = Object.entries(DEFECT_SECTION_FIELDS);
  // A ready pair never silently falls back to storing NEW file bytes inline.
  const ready = await getDefectFileReadiness(current?.vesselId ?? body.vesselId);
  if (ready.externalStorage && pairs.some(([, field]) => Array.isArray(body[field]) &&
      body[field].some((file: any) => !isExternalDefectAttachment(file) &&
        !(current?.[field] ?? []).some((old: any) => isDeepStrictEqual(old, file))))) {
    throw fileError('This vessel requires private file uploads. Please attach the file again.', 409, 'EXTERNAL_UPLOAD_REQUIRED');
  }
  const fileChange = pairs.some(([, field]) => body[field] !== undefined &&
    !isDeepStrictEqual(body[field], current?.[field] ?? []) &&
    [...(body[field] ?? []), ...(current?.[field] ?? [])].some(isExternalDefectAttachment));
  if (!fileChange) {
    const output = { ...body }; delete output.attachmentCommit;
    return work(output);
  }
  if (!actor) throw fileError('A verified session is required to save external files.', 403);
  const session = body.attachmentCommit;
  if (!UUID.test(session?.sessionId ?? '')) throw fileError('The upload session is missing. Please refresh.');
  const vessel = current?.vesselId ?? body.vesselId;
  const db = await getDb();
  return db.transaction(async tx => {
    let locked = current;
    if (current) {
      [locked] = await tx.select().from(defects).where(eq(defects.duuid, current.duuid)).for('update');
      if (!locked || new Date(locked.updatedAt).toISOString() !== session.expectedUpdatedAt) {
        throw fileError('This defect changed while you were editing. Refresh before saving; your staged files are retained.', 409, 'DEFECT_STALE');
      }
    }
    const output = { ...body };
    delete output.attachmentCommit;
    const staged: StagedDefectFile[] = [];
    let duuid = locked?.duuid;
    for (const [section, field] of pairs) {
      if (!Array.isArray(body[field])) continue;
      const saved = locked?.[field] ?? [];
      const ids = new Set<string>();
      output[field] = [];
      for (const input of body[field]) {
        if (!input?.id || ids.has(input.id)) throw fileError('Duplicate or missing attachment identity.');
        ids.add(input.id);
        const old = saved.find((file: any) => file.id === input.id);
        if (old) {
          if (isExternalDefectAttachment(old) && !isDeepStrictEqual(old, input)) throw fileError('Saved files are immutable. Attach a replacement as a new file.', 409);
          output[field].push(input);
          continue;
        }
        if (!isExternalDefectAttachment(input)) { output[field].push(input); continue; }
        if (!input.stagedRef) throw fileError('A new external file requires an owned staged upload.');
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.stagedRef}))`);
        const manifest = await readStagedDefectFile(actor, input.stagedRef, input.backend);
        const claimed = { ...input }; delete claimed.stagedRef;
        if (!isDeepStrictEqual(claimed, manifest.attachment)) throw fileError('Staged attachment metadata was changed. Please attach the file again.', 409);
        if (manifest.sessionId !== session.sessionId || manifest.section !== section || manifest.vesselUuid !== vessel ||
            (duuid && manifest.defectUuid !== duuid)) throw fileError('Staged file ownership does not match this form.', 403);
        duuid ??= manifest.defectUuid;
        if (!current) {
          const [alreadySaved] = await tx.select({ id: defects.id }).from(defects).where(eq(defects.duuid, duuid));
          if (alreadySaved) throw fileError('This staged form was already saved. Refresh to load its saved record.', 409, 'DEFECT_ALREADY_SAVED');
        }
        await assertDefectFileAccess(actor, vessel, manifest.section, locked);
        const ready = await getDefectFileReadiness(vessel);
        if (!ready.externalStorage || (section === 'part-c1' && !ready.c1Upload)) {
          throw fileError('File compatibility changed before saving. Please retry after the vessel update; your form values are retained.', 409, 'DEFECT_FILES_UNAVAILABLE');
        }
        const bytes = await defectFileStore.read(`${stagingNamespace(actor)}/${manifest.token}.bin`, manifest.attachment.backend, true);
        if (bytes.length !== manifest.attachment.size || fileHash(bytes) !== manifest.attachment.sha256) throw fileError('Staged file integrity check failed.', 409);
        try { await defectFileStore.write(manifest.attachment.fileKey, bytes, manifest.attachment.backend); }
        catch (error: any) {
          // Retry only an identical, already-prepared immutable file.
          if (error.code !== 'EEXIST' && error.code !== 412) throw error;
          const prepared = await defectFileStore.read(manifest.attachment.fileKey, manifest.attachment.backend);
          if (fileHash(prepared) !== manifest.attachment.sha256) throw fileError('Prepared file content conflicts with this upload.', 409);
        }
        output[field].push(manifest.attachment);
        staged.push(manifest);
      }
      if (!isDeepStrictEqual(output[field], saved)) await assertDefectFileAccess(actor, vessel, section as any, locked);
    }
    await revalidate(locked, output);
    const result = await defectFileCommitContext.run({ tx, duuid, actorUuid: actor.userUuid }, () => work(output));
    if (staged.length) {
      const finalReady = await getDefectFileReadiness(vessel);
      if (!finalReady.externalStorage || (staged.some(file => file.section === 'part-c1') && !finalReady.c1Upload)) {
        throw fileError('File compatibility changed before saving. Please retry; your staged uploads are retained.', 409, 'DEFECT_FILES_UNAVAILABLE');
      }
    }
    const instance = await getEffectiveInstanceId();
    const direction = await isShipInstance() ? 'ship_to_shore' : 'shore_to_ship';
    for (const manifest of staged) {
      const file = manifest.attachment;
      await tx.insert(syncFileQueue).values({
        tableName: 'defects', rowUuid: duuid, fileKey: file.fileKey, fileName: file.name,
        fileSizeBytes: file.size, fileHash: file.sha256, totalChunks: Math.ceil(file.size / (256 * 1024)),
        vesselId: vessel, direction, instanceId: instance, status: 'pending',
      });
    }
    await tx.insert(auditLog).values({
      userId: actor.userUuid, entityType: 'defects', entityId: duuid,
      actionType: 'attachments-save', source: 'web_ui', createdByUuid: actor.userUuid,
      payload: { vesselUuid: vessel, added: staged.map(s => ({ id: s.attachment.id, section: s.section, sha256: s.attachment.sha256 })),
        removed: pairs.flatMap(([section, field]) => (locked?.[field] ?? []).filter((old: any) =>
          output[field] && !output[field].some((file: any) => file.id === old.id)).map((file: any) => ({ section, id: file.id }))) },
    });
    return result;
  });
}

import { createHash, randomUUID } from 'node:crypto';
import {
  DEFECT_FILE_BYTES, DEFECT_STAGING_TTL_MS, UUID, defectFileKey,
  type DefectFileSection, type ExternalDefectAttachment,
} from '@shared/defectAttachments';
import { defectFileStore, fileHash, type DefectFileStore } from './defectFileStorage';
import { assertDefectFileAccess, fileError, type DefectFileActor } from './defectFileAccess';
import { assertLocalC1UploadAvailable } from './defectFileReadiness';

export type StagedDefectFile = {
  token: string; tenant: string; actorUuid: string; sessionId: string; vesselUuid: string;
  defectUuid: string; section: DefectFileSection; expiresAt: number; attachment: ExternalDefectAttachment;
};
export function stagingNamespace(actor: DefectFileActor) {
  return createHash('sha256').update(actor.tenant).digest('hex');
}
export function draftDefectUuid(actor: DefectFileActor, session: string, vessel: string) {
  const hash = createHash('sha256').update(JSON.stringify([actor.tenant, actor.userUuid, session, vessel])).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export function validateDefectUpload(file: { originalname: string; buffer: Buffer; mimetype: string }) {
  const bytes = file?.buffer;
  if (!bytes?.length || bytes.length > DEFECT_FILE_BYTES) throw fileError('Choose one PDF, JPG or PNG file no larger than 5 MB.');
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  const kind = bytes.subarray(0, 5).toString() === '%PDF-' ? ['pdf', 'application/pdf'] :
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? ['png', 'image/png'] :
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? ['jpg', 'image/jpeg'] : null;
  if (!kind || ![kind[0], ...(kind[0] === 'jpg' ? ['jpeg'] : [])].includes(extension ?? '') ||
      (file.mimetype !== kind[1] && file.mimetype !== 'application/octet-stream')) {
    throw fileError('The file content does not match a supported PDF, JPG or PNG file.');
  }
  return { extension: kind[0], type: kind[1], name: file.originalname.replace(/[\x00-\x1f/\\]/g, '_').slice(0, 200) };
}
export async function stageDefectFile(actor: DefectFileActor, input: {
  vesselUuid: string; sessionId: string; section: DefectFileSection;
}, file: { originalname: string; buffer: Buffer; mimetype: string }, current?: any, store: DefectFileStore = defectFileStore) {
  if (!UUID.test(input.sessionId) || !UUID.test(input.vesselUuid)) throw fileError('A valid vessel and upload session are required.');
  if (current && current.vesselId !== input.vesselUuid) throw fileError('The defect does not belong to this vessel.', 403);
  await assertDefectFileAccess(actor, input.vesselUuid, input.section, current);
  await assertLocalC1UploadAvailable();
  const checked = validateDefectUpload(file);
  const token = randomUUID();
  const defectUuid = current?.duuid ?? draftDefectUuid(actor, input.sessionId, input.vesselUuid);
  const backend = store.backend();
  const attachment: ExternalDefectAttachment = {
    storageVersion: 1, id: randomUUID(), name: checked.name, size: file.buffer.length, type: checked.type,
    uploadedAt: new Date().toISOString(), fileKey: '', backend, sha256: fileHash(file.buffer), uploadedByUuid: actor.userUuid,
  };
  attachment.fileKey = defectFileKey(input.vesselUuid, defectUuid, input.section, attachment.id, checked.extension);
  const manifest: StagedDefectFile = { token, tenant: actor.tenant, actorUuid: actor.userUuid,
    sessionId: input.sessionId, vesselUuid: input.vesselUuid, defectUuid, section: input.section,
    expiresAt: Date.now() + DEFECT_STAGING_TTL_MS, attachment };
  const prefix = `${stagingNamespace(actor)}/${token}`;
  await store.write(`${prefix}.bin`, file.buffer, backend, true);
  try { await store.write(`${prefix}.json`, Buffer.from(JSON.stringify(manifest)), backend, true); }
  catch (error) { await store.remove(`${prefix}.bin`, backend, true); throw error; }
  return { ...attachment, stagedRef: token };
}
export async function readStagedDefectFile(actor: DefectFileActor, token: string, backend: string, store = defectFileStore) {
  if (!UUID.test(token)) throw fileError('Invalid staged upload reference.');
  let manifest: StagedDefectFile;
  try { manifest = JSON.parse((await store.read(`${stagingNamespace(actor)}/${token}.json`, backend, true)).toString()); }
  catch { throw fileError('This upload is unavailable or expired. Please attach the file again.', 409); }
  if (manifest.tenant !== actor.tenant || manifest.actorUuid !== actor.userUuid || manifest.token !== token) throw fileError('This upload belongs to another user.', 403);
  if (manifest.expiresAt <= Date.now()) throw fileError('This upload expired after 7 days. Please attach the file again.', 409, 'UPLOAD_EXPIRED');
  return manifest;
}

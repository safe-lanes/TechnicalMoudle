import { fileError } from './defectFileAccess';
/** Form eligibility is local only; these aliases do not attest to sync compatibility. */
export async function getDefectFileReadiness(vesselUuid: string) {
  const { localDefectPrerequisites } = await import('../../sync/defectFileReadiness');
  const local = await localDefectPrerequisites();
  const eligible = local.migration191 && local.capability;
  const reason = localReason(local);
  return { vesselUuid, local, report: null, state: eligible ? 'ready' : 'lost',
    ready: eligible, reason, externalStorage: eligible, c1Upload: eligible,
    c1LocalUpload: eligible, c1LocalReason: reason };
}

function localReason(local: { migration191: boolean; capability: boolean }) {
  return !local.migration191
    ? 'C1 attachments require database migration 191 on this installation. Contact your administrator.'
    : !local.capability
      ? 'Private file storage is not readable and writable on this installation. Contact your administrator.'
      : '';
}

/** All local attachment writes use the existing C1 prerequisites, not peer readiness. */
export async function getLocalC1Availability() {
  const { localDefectPrerequisites } = await import('../../sync/defectFileReadiness');
  const local = await localDefectPrerequisites();
  return {
    c1LocalUpload: local.migration191 && local.capability,
    c1LocalReason: localReason(local),
  };
}

export async function assertLocalC1UploadAvailable() {
  const local = await getLocalC1Availability();
  if (!local.c1LocalUpload) throw fileError(local.c1LocalReason, 409, 'C1_LOCAL_UNAVAILABLE');
}

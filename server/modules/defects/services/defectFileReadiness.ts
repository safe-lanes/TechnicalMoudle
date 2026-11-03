import { fileError } from './defectFileAccess';
/** Replaced by authenticated owning-vessel peer evaluation in M3, not an env switch. */
export async function getDefectFileReadiness(vesselUuid: string) {
  const { defectReadiness } = await import('../../sync/defectFileReadiness');
  return defectReadiness(vesselUuid);
}

/** Local C1 writes do not attest to counterpart compatibility or enable sync. */
export async function getLocalC1Availability() {
  const { localDefectPrerequisites } = await import('../../sync/defectFileReadiness');
  const local = await localDefectPrerequisites();
  return {
    c1LocalUpload: local.migration191 && local.capability,
    c1LocalReason: !local.migration191
      ? 'C1 attachments require database migration 191 on this installation. Contact your administrator.'
      : !local.capability
        ? 'Private file storage is not readable and writable on this installation. Contact your administrator.'
        : '',
  };
}

export async function assertLocalC1UploadAvailable() {
  const local = await getLocalC1Availability();
  if (!local.c1LocalUpload) throw fileError(local.c1LocalReason, 409, 'C1_LOCAL_UNAVAILABLE');
}

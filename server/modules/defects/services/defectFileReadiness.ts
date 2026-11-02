import { defectAttachmentAvailability } from '@shared/defectEvidence';
/** Replaced by authenticated owning-vessel peer evaluation in M3, not an env switch. */
export async function getDefectFileReadiness(vesselUuid: string) {
  const { defectReadiness } = await import('../../sync/defectFileReadiness');
  return defectReadiness(vesselUuid);
}

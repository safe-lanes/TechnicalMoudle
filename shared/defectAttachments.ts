export const DEFECT_FILE_BYTES = 5 * 1024 * 1024;
export const DEFECT_STAGING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFECT_SECTIONS = ['part-a', 'part-b', 'part-c1'] as const;
export type DefectFileSection = typeof DEFECT_SECTIONS[number];
export const DEFECT_SECTION_FIELDS = {
  'part-a': 'partAAttachments', 'part-b': 'attachments', 'part-c1': 'partCAttachments',
} as const;
export interface InlineDefectAttachment {
  id: string; name: string; size: number; type: string; data: string; uploadedAt: string;
}
export interface ExternalDefectAttachment {
  storageVersion: 1;
  id: string; name: string; size: number; type: string; uploadedAt: string;
  fileKey: string; backend: 'local' | 'object'; sha256: string; uploadedByUuid: string;
  /** Client-only receipt; removed before persistence and never field-logged. */
  stagedRef?: string;
}
export type DefectAttachment = InlineDefectAttachment | ExternalDefectAttachment;
export const isExternalDefectAttachment = (file: any): file is ExternalDefectAttachment =>
  file?.storageVersion === 1;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export function defectFileKey(vessel: string, defect: string, section: DefectFileSection, id: string, extension: string) {
  if (![vessel, defect, id].every(value => UUID.test(value)) ||
      !DEFECT_SECTIONS.includes(section) || !['pdf', 'jpg', 'png'].includes(extension)) {
    throw new Error('Invalid defect attachment identity.');
  }
  return `${vessel}/${defect}/${section}/${id}.${extension}`;
}
export function validateDefectFileKey(key: string) {
  const [vessel, defect, section, filename, extra] = key.split('/');
  const parts = filename?.split('.') ?? [];
  if (extra !== undefined || parts.length !== 2 ||
      defectFileKey(vessel, defect, section as DefectFileSection, parts[0], parts[1]) !== key) {
    throw new Error('Invalid defect attachment key.');
  }
  return { vessel, defect, section: section as DefectFileSection, id: parts[0] };
}

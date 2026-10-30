/** Limits are active per-entry quotas; removed files remain retained, not counted. */
export const SECTION_H_FILE_BYTES = 10 * 1024 * 1024;
export const SECTION_H_TOTAL_BYTES = 25 * 1024 * 1024;
export const SECTION_H_FILE_COUNT = 5;
export const SECTION_H_ATTACHMENT_TABLE = "component_class_regulatory_attachments";
export const SECTION_H_ATTACHMENT_CAPABILITY = "section_h_attachments_v1";
export const SECTION_H_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SECTION_H_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export function assertAttachmentQuota(count: number, bytes: number, added: number) {
  if (!Number.isSafeInteger(added) || added <= 0 || added > SECTION_H_FILE_BYTES)
    throw new Error("Each attachment must be non-empty and no larger than 10 MB.");
  if (count >= SECTION_H_FILE_COUNT) throw new Error("An entry can have at most 5 active attachments.");
  if (bytes + added > SECTION_H_TOTAL_BYTES) throw new Error("Active attachments cannot exceed 25 MB combined per entry.");
}
export function sectionHFileKey(vessel: string, entry: string, attachment: string, name: string) {
  if (![vessel, entry, attachment].every(value => SECTION_H_UUID.test(value))) throw new Error("Invalid attachment ownership identity.");
  const safe = name.replace(/[^A-Za-z0-9._()-]/g, "_").slice(0, 160);
  if (!safe || safe.startsWith(".")) throw new Error("Invalid attachment filename.");
  return `${vessel}/${entry}/${attachment}_${safe}`;
}

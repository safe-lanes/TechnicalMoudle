import { isExternalDefectAttachment, type DefectAttachment, type DefectFileSection } from '@shared/defectAttachments';
import { defectFileUrl, fetchDefectFile } from './DefectAttachmentDialog';

export async function prepareDefectPdfAttachments(
  sections: Array<{ section: DefectFileSection; files: DefectAttachment[] }>,
  defectId: string | number | undefined, sessionId: string, headers: Record<string, string>,
) {
  const fileImages: Array<{ label: string; data: string }> = [];
  const fileNotes: string[] = [];
  for (const { section, files } of sections) {
    for (const file of files) {
      const label = `${section.toUpperCase()} — ${file.name}`;
      try {
        let data: string;
        if (isExternalDefectAttachment(file)) {
          const url = file.stagedRef
            ? `/technical/api/defects/file-staging/${file.stagedRef}?sessionId=${sessionId}&backend=${file.backend}`
            : defectFileUrl(defectId!, section, file.id);
          const blob = await fetchDefectFile(url, headers);
          data = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject; reader.readAsDataURL(blob);
          });
        } else data = file.data;
        if (/^data:image\/(?:jpeg|png);base64,/.test(data)) fileImages.push({ label, data });
        else fileNotes.push(label);
      } catch (error: any) {
        fileNotes.push(`${label} — ${error.message || 'File unavailable'}`);
      }
    }
  }
  return { fileImages, fileNotes };
}

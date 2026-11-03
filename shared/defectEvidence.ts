import { validateDefectFileKey } from './defectAttachments';
/** Read-only compatibility resolution. Never copy/reclassify legacy evidence on save. */
export type EvidenceFile = {
  id: string; name: string; data?: string; url?: string;
  storageVersion?: number; fileKey?: string; stagedRef?: string; backend?: string;
};
export type LegacyEvidenceFile = { datuuid: string; filename: string; url?: string };
export type ResolvedDefectEvidence = {
  id: string; name: string; source: 'c1' | 'legacy' | 'unavailable'; href?: string; external?: boolean; staged?: boolean;
};

function safeEvidenceHref(value?: string): string | undefined {
  if (!value) return undefined;
  return /^(https?:\/\/|\/(?!\/)|data:(application\/pdf|image\/(jpeg|png));base64,)/i.test(value)
    ? value : undefined;
}

export function resolveDefectEvidence(
  ids: readonly string[],
  c1: readonly EvidenceFile[] = [],
  partB: readonly EvidenceFile[] = [],
  separate: readonly LegacyEvidenceFile[] = [],
  sessionId?: string,
): ResolvedDefectEvidence[] {
  return ids.map((id) => {
    // Prefer C1, then inline Part B, then the same defect's separate legacy rows.
    for (const [files, source] of [[c1, 'c1'], [partB, 'legacy']] as const) {
      const matches = files.filter((file) => file.id === id);
      if (matches.length > 1) return { id, name: id, source: 'unavailable' as const };
      if (matches.length === 1) {
        const file = matches[0];
        if (file.storageVersion === 1 && file.fileKey) {
          try {
            const owner = validateDefectFileKey(file.fileKey);
            const href = file.stagedRef && sessionId
              ? `/technical/api/defects/file-staging/${encodeURIComponent(file.stagedRef)}?sessionId=${encodeURIComponent(sessionId)}&backend=${encodeURIComponent(file.backend ?? '')}`
              : `/technical/api/defects/${owner.defect}/files/${owner.section}/${owner.id}`;
            return { id, name: file.name, source, href, external: true, staged: Boolean(file.stagedRef) };
          } catch { return { id, name: file.name, source: 'unavailable' as const }; }
        }
        return { id, name: file.name, source, href: safeEvidenceHref(file.data ?? file.url) };
      }
    }
    const matches = separate.filter((file) => file.datuuid === id);
    if (matches.length === 1) {
      return { id, name: matches[0].filename, source: 'legacy' as const, href: safeEvidenceHref(matches[0].url) };
    }
    return { id, name: id, source: 'unavailable' as const };
  });
}

export function defectEvidenceLabel(file: ResolvedDefectEvidence): string {
  return `${file.name}${file.source === 'legacy' ? ' — Legacy evidence' : file.source === 'unavailable' ? ' — Evidence unavailable' : ''}`;
}

export const C1_UNAVAILABLE_MESSAGE = "Part C1 will be available after this vessel's software update.";
export const STALE_CLOSURE_MESSAGE = 'This form is out of date. Please refresh the page, then attach closure documents in Part C1.';

/** Fail-closed UI defaults. Local C1 eligibility is distinct from peer sync readiness. */
export function defectAttachmentAvailability(): {
  c1Upload: boolean; externalStorage: boolean; reason: string;
  c1LocalUpload: boolean; c1LocalReason: string;
} {
  return { c1Upload: false, externalStorage: false, reason: C1_UNAVAILABLE_MESSAGE,
    c1LocalUpload: false, c1LocalReason: 'Checking local C1 attachment availability…' };
}

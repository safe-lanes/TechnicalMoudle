import { getApiMode } from './componentApiV2';

const V2_BULK_BASE = '/technical/api/v2/bulk';
const LEGACY_BULK_BASE = '/technical/api/bulk';

export function getBulkHistoryUrl(templateType: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_BULK_BASE : LEGACY_BULK_BASE;
  return `${base}/history?type=${templateType}&limit=50`;
}

export function getBulkHistoryQueryKey(templateType: string): string[] {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_BULK_BASE : LEGACY_BULK_BASE;
  return [`${base}/history`, templateType];
}

export function getBulkTemplateUrl(templateType: string, vesselId: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_BULK_BASE : LEGACY_BULK_BASE;
  return `${base}/template?type=${templateType}&vesselId=${vesselId}`;
}

export function getBulkSheetsUrl(): string {
  const mode = getApiMode();
  return mode === 'v2' ? `${V2_BULK_BASE}/sheets` : `${LEGACY_BULK_BASE}/sheets`;
}

export function getBulkDryRunUrl(): string {
  const mode = getApiMode();
  return mode === 'v2' ? `${V2_BULK_BASE}/dry-run` : `${LEGACY_BULK_BASE}/dry-run`;
}

export function getBulkImportUrl(): string {
  const mode = getApiMode();
  return mode === 'v2' ? `${V2_BULK_BASE}/import` : `${LEGACY_BULK_BASE}/import`;
}

export function getBulkUndoUrl(historyId: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_BULK_BASE : LEGACY_BULK_BASE;
  return `${base}/undo/${historyId}`;
}

export function getBulkDownloadOriginalUrl(historyId: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_BULK_BASE : LEGACY_BULK_BASE;
  return `${base}/history/${historyId}/download-original`;
}

export function getBulkHistoryFileUrl(historyId: string, fileType: string): string {
  const mode = getApiMode();
  const base = mode === 'v2' ? V2_BULK_BASE : LEGACY_BULK_BASE;
  return `${base}/history/${historyId}/${fileType}`;
}

const STORAGE_KEY = 'pms_api_version';

export type ApiMode = 'legacy' | 'v2';

export function getApiMode(): ApiMode {
  const mode = localStorage.getItem(STORAGE_KEY);
  return mode === 'v2' ? 'v2' : 'legacy';
}

export function setApiMode(mode: ApiMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

const V2_BASE = '/technical/api/v2/components';
const LEGACY_BASE = '/technical/api';

export function getComponentListUrl(vesselId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/vessel/${vesselId}`
    : `${LEGACY_BASE}/components/${vesselId}`;
}

export function getComponentByIdUrl(id: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${id}`
    : `${LEGACY_BASE}/components/details/${id}`;
}

export function getComponentDetailsUrl(id: string): string {
  return getComponentByIdUrl(id);
}

export function getComponentDocumentsUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${componentId}/documents`
    : `${LEGACY_BASE}/component-documents/${componentId}`;
}

export function getComponentClassRegulatoryUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${componentId}/class-regulatory`
    : `${LEGACY_BASE}/component-class-regulatory/${componentId}`;
}

export function getComponentRequisitionsUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${componentId}/requisitions`
    : `${LEGACY_BASE}/component-requisitions/${componentId}`;
}

export function getMaintenanceHistoryUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${componentId}/maintenance-history`
    : `${LEGACY_BASE}/component-maintenance-history/${componentId}`;
}

export function getMaintenanceHistoryAllUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/maintenance-history`
    : `${LEGACY_BASE}/component-maintenance-history/all`;
}

export function getCreateComponentUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? V2_BASE
    : `${LEGACY_BASE}/components`;
}

export function getUpdateComponentUrl(id: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${id}`
    : `${LEGACY_BASE}/components/${id}`;
}

export function getDeleteComponentUrl(id: string): string {
  return getUpdateComponentUrl(id);
}

export function getInactivateComponentUrl(id: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${id}/status`
    : `${LEGACY_BASE}/components/${id}/inactivate`;
}

export function getBulkUploadUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/upload`
    : `${LEGACY_BASE}/components/upload`;
}

export function getDocumentCreateUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${componentId}/documents`
    : `${LEGACY_BASE}/component-documents`;
}

export function getDocumentDownloadUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/documents/${id}/download`
    : `${LEGACY_BASE}/component-documents/${id}/download`;
}

export function getDocumentUpdateUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/documents/${id}`
    : `${LEGACY_BASE}/component-documents/${id}`;
}

export function getDocumentDeleteUrl(id: number): string {
  return getDocumentUpdateUrl(id);
}

export function getClassRegulatoryCreateUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${componentId}/class-regulatory`
    : `${LEGACY_BASE}/component-class-regulatory`;
}

export function getClassRegulatoryUpdateUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/class-regulatory/${id}`
    : `${LEGACY_BASE}/component-class-regulatory/${id}`;
}

export function getClassRegulatoryDeleteUrl(id: number): string {
  return getClassRegulatoryUpdateUrl(id);
}

export function getRequisitionCreateUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/${componentId}/requisitions`
    : `${LEGACY_BASE}/component-requisitions`;
}

export function getRequisitionsAllUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/requisitions`
    : `${LEGACY_BASE}/component-requisitions/all`;
}

export function getRequisitionItemUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/requisitions/${id}`
    : `${LEGACY_BASE}/component-requisitions/${id}`;
}

export function getRequisitionUpdateUrl(id: number): string {
  return getRequisitionItemUrl(id);
}

export function getRequisitionDeleteUrl(id: number): string {
  return getRequisitionItemUrl(id);
}

export function getMaintenanceHistoryItemUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/maintenance-history/${id}`
    : `${LEGACY_BASE}/component-maintenance-history/${id}`;
}

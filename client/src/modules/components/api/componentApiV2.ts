const STORAGE_KEY = 'pms_api_version';

export type ApiMode = 'legacy' | 'v2';

export function getApiMode(): ApiMode {
  const mode = localStorage.getItem(STORAGE_KEY);
  return mode === 'v2' ? 'v2' : 'legacy';
}

export function setApiMode(mode: ApiMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

function getApiBase(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? '/technical/api/v2/components/component'
    : '/technical/api';
}

export function getComponentListUrl(vesselId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/${vesselId}`
    : `/technical/api/components/${vesselId}`;
}

export function getComponentByIdUrl(id: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/by-id/${id}`
    : `/technical/api/components/details/${id}`;
}

export function getComponentDetailsUrl(id: string): string {
  return getComponentByIdUrl(id);
}

export function getComponentDocumentsUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/${componentId}/documents`
    : `/technical/api/component-documents/${componentId}`;
}

export function getComponentClassRegulatoryUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/${componentId}/class-regulatory`
    : `/technical/api/component-class-regulatory/${componentId}`;
}

export function getComponentRequisitionsUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/${componentId}/requisitions`
    : `/technical/api/component-requisitions/${componentId}`;
}

export function getMaintenanceHistoryUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/maintenance-history/${componentId}`
    : `/technical/api/component-maintenance-history/${componentId}`;
}

export function getMaintenanceHistoryAllUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/maintenance-history/all`
    : `/technical/api/component-maintenance-history/all`;
}

export function getCreateComponentUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component`
    : `/technical/api/components`;
}

export function getUpdateComponentUrl(id: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/${id}`
    : `/technical/api/components/${id}`;
}

export function getDeleteComponentUrl(id: string): string {
  return getUpdateComponentUrl(id);
}

export function getBulkUploadUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/upload`
    : `/technical/api/components/upload`;
}

export function getDocumentUploadUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/documents`
    : `/technical/api/component-documents`;
}

export function getDocumentDownloadUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/documents/${id}/download`
    : `/technical/api/component-documents/${id}/download`;
}

export function getDocumentUpdateUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/documents/${id}`
    : `/technical/api/component-documents/${id}`;
}

export function getDocumentDeleteUrl(id: number): string {
  return getDocumentUpdateUrl(id);
}

export function getClassRegulatoryCreateUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/class-regulatory`
    : `/technical/api/component-class-regulatory`;
}

export function getClassRegulatoryUpdateUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/class-regulatory/${id}`
    : `/technical/api/component-class-regulatory/${id}`;
}

export function getClassRegulatoryDeleteUrl(id: number): string {
  return getClassRegulatoryUpdateUrl(id);
}

export function getRequisitionCreateUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/requisitions`
    : `/technical/api/component-requisitions`;
}

export function getRequisitionUpdateUrl(id: number): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `/technical/api/v2/components/component/requisitions/${id}`
    : `/technical/api/component-requisitions/${id}`;
}

export function getRequisitionDeleteUrl(id: number): string {
  return getRequisitionUpdateUrl(id);
}

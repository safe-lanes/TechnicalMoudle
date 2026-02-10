import { getApiMode } from './componentApiV2';

const V2_WO_BASE = '/technical/api/v2/work-orders';
const LEGACY_WO_BASE = '/technical/api/work-orders';

function getBase(): string {
  return getApiMode() === 'v2' ? V2_WO_BASE : LEGACY_WO_BASE;
}

export function getWorkOrdersListUrl(vesselId?: string): string {
  const base = getBase();
  if (vesselId) return `${base}?vesselId=${vesselId}`;
  return base;
}

export function getWorkOrdersListQueryKey(vesselId?: string): (string | undefined)[] {
  const base = getBase();
  if (vesselId !== undefined) return [base, vesselId];
  return [base];
}

export function getWorkOrderByIdUrl(id: string): string {
  return `${getBase()}/${id}`;
}

export function getWorkOrderContextUrl(id: string): string {
  return `${getBase()}/${id}/context`;
}

export function getWorkOrderContextQueryKey(id: string): string[] {
  return [`${getBase()}/${id}/context`];
}

export function getCreateWorkOrderUrl(): string {
  return getBase();
}

export function getUpdateWorkOrderUrl(id: string): string {
  return `${getBase()}/${id}`;
}

export function getDeleteWorkOrderUrl(id: string): string {
  return `${getBase()}/${id}`;
}

export function getBulkApproveUrl(): string {
  return `${getBase()}/bulk-approve`;
}

export function getBulkRejectUrl(): string {
  return `${getBase()}/bulk-reject`;
}

export function getCompleteWorkOrderUrl(id: string): string {
  return `${getBase()}/${id}/complete`;
}

export function getAutoGenerateUrl(): string {
  return `${getBase()}/auto-generate`;
}

export function getRecalculateStatusesUrl(): string {
  return `${getBase()}/recalculate-statuses`;
}

export function getCheckPostponementsUrl(): string {
  return `${getBase()}/check-postponements`;
}

export function getWorkOrdersBaseUrl(): string {
  return getBase();
}

export function getWorkOrdersInvalidationPrefix(): string {
  return getBase();
}

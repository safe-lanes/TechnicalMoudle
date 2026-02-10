import { getApiMode } from './componentApiV2';

const V2_BASE = '/technical/api/v2';
const LEGACY_BASE = '/technical/api';

export function getRunningHoursParentsUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/running-hours/parents`
    : `${LEGACY_BASE}/running-hours/parents`;
}

export function getRunningHoursChildrenUrl(parentCode: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/running-hours/children/${parentCode}`
    : `${LEGACY_BASE}/running-hours/children/${parentCode}`;
}

export function getUpdateChildRHUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/running-hours/child/${componentId}`
    : `${LEGACY_BASE}/running-hours/child/${componentId}`;
}

export function getCascadeUrl(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/rh-config/master`
    : `${LEGACY_BASE}/running-hours/cascade`;
}

export function getRHConfigUrl(componentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/rh-config/${componentId}`
    : `${LEGACY_BASE}/rh-config/${componentId}`;
}

export function getRHConfigMasterComponentsUrl(vesselId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/rh-config/master-components/${vesselId}`
    : `${LEGACY_BASE}/rh-config/master-components/${vesselId}`;
}

export function getRHConfigInheritedUrl(masterComponentId: string): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/rh-config/inherited/${masterComponentId}`
    : `${LEGACY_BASE}/rh-config/inherited/${masterComponentId}`;
}

export function getRunningHoursParentsQueryKey(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/running-hours/parents`
    : `${LEGACY_BASE}/running-hours/parents`;
}

export function getRunningHoursChildrenQueryKey(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/running-hours/children`
    : `${LEGACY_BASE}/running-hours/children`;
}

export function getRHConfigQueryKey(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/rh-config`
    : `${LEGACY_BASE}/rh-config`;
}

export function getRHConfigMasterComponentsQueryKey(): string {
  const mode = getApiMode();
  return mode === 'v2'
    ? `${V2_BASE}/rh-config/master-components`
    : `${LEGACY_BASE}/rh-config/master-components`;
}

export interface CascadePayload {
  parentComponentId: string;
  mode: 'setTotal' | 'addDelta';
  value: number;
  dateUpdated: string;
  comments?: string;
  vesselId?: string;
  userRole?: string;
  adminOverride?: boolean;
  meterReplaced?: boolean;
  oldMeterFinal?: string;
  newMeterStart?: string;
}

export function buildCascadeRequest(payload: CascadePayload): { url: string; method: string; body: any } {
  const mode = getApiMode();
  if (mode === 'v2') {
    const currentRH = parseFloat(payload.oldMeterFinal || '0');
    const newRHValue = payload.mode === 'setTotal'
      ? payload.value
      : currentRH + payload.value;

    return {
      url: `${V2_BASE}/rh-config/master/${payload.parentComponentId}`,
      method: 'PUT',
      body: {
        newRHValue,
        userRole: payload.userRole || 'Ship',
        adminOverride: payload.adminOverride || false,
        comments: payload.comments,
        dateUpdated: payload.dateUpdated,
      }
    };
  }
  return {
    url: `${LEGACY_BASE}/running-hours/cascade`,
    method: 'POST',
    body: payload,
  };
}

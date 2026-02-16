import { getApiMode } from './componentApiV2';

const V2_SPARES_BASE = '/technical/api/v2/spares';
const LEGACY_SPARES_BASE = '/technical/api/spares';

function getBase(): string {
  return getApiMode() === 'v2' ? V2_SPARES_BASE : LEGACY_SPARES_BASE;
}

export function isV2Mode(): boolean {
  return getApiMode() === 'v2';
}

export function getSparesWithInventoryUrl(vesselId: string): string {
  if (getApiMode() === 'v2') {
    return `${V2_SPARES_BASE}/${vesselId}`;
  }
  return `/technical/api/inventory/spares-with-inventory/${vesselId}`;
}

export function getSparesWithInventoryQueryKey(vesselId: string): (string | undefined)[] {
  if (getApiMode() === 'v2') {
    return [V2_SPARES_BASE, vesselId];
  }
  return ['/technical/api/inventory/spares-with-inventory', vesselId];
}

export function getHistoryQueryKey(vesselId: string): (string | undefined)[] {
  if (getApiMode() === 'v2') {
    return [`${V2_SPARES_BASE}/history`, vesselId];
  }
  return ['/technical/api/spares/history', vesselId];
}

// List all spares (no vessel filter)
export function getSparesListAllUrl(): string {
  return getBase();
}

// List spares by vessel
export function getSparesListUrl(vesselId: string): string {
  return `${getBase()}/${vesselId}`;
}

// Get spare by suuid
export function getSpareByIdUrl(vesselId: string, suuid: string): string {
  return `${getBase()}/${vesselId}/${suuid}`;
}

// Create spare
export function getCreateSpareUrl(vesselId: string): string {
  return `${getBase()}/${vesselId}`;
}

// Update spare (PATCH)
export function getUpdateSpareUrl(vesselId: string, suuid: string): string {
  return `${getBase()}/${vesselId}/${suuid}`;
}

// Delete spare
export function getDeleteSpareUrl(vesselId: string, suuid: string): string {
  return `${getBase()}/${vesselId}/${suuid}`;
}

// Adjustment (POST)
export function getAdjustmentUrl(vesselId: string, suuid: string): string {
  return `${getBase()}/${vesselId}/${suuid}/adjustment`;
}

// Adjust quantity (POST)
export function getAdjustUrl(vesselId: string, suuid: string): string {
  return `${getBase()}/${vesselId}/${suuid}/adjust`;
}

// History by vessel - two formats for compatibility
export function getHistoryUrl(vesselId: string): string {
  return `${getBase()}/history/${vesselId}`;
}

export function getHistoryLegacyUrl(vesselId: string): string {
  return `${getBase()}/${vesselId}/history`;
}

// Low stock
export function getLowStockUrl(vesselId: string): string {
  return `${getBase()}/${vesselId}/low-stock`;
}

// Batch consume
export function getBatchConsumeUrl(vesselId: string): string {
  return `${getBase()}/${vesselId}/batch-consume`;
}

// Batch receive
export function getBatchReceiveUrl(vesselId: string): string {
  return `${getBase()}/${vesselId}/batch-receive`;
}

// Simple consume (no vessel prefix)
export function getConsumeUrl(suuid: string): string {
  return `${getBase()}/${suuid}/consume`;
}

// Simple receive (no vessel prefix)
export function getReceiveUrl(suuid: string): string {
  return `${getBase()}/${suuid}/receive`;
}

// Location-aware consume
export function getConsumeFromLocationUrl(suuid: string): string {
  return `${getBase()}/${suuid}/consume-from-location`;
}

// Location-aware receive
export function getReceiveToLocationUrl(suuid: string): string {
  return `${getBase()}/${suuid}/receive-to-location`;
}

// Bulk update
export function getBulkUpdateUrl(): string {
  return `${getBase()}/bulk-update`;
}

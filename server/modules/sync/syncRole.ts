/**
 * Centralized ship/shore role detection.
 *
 * Single source of truth for determining if this instance is a ship or shore.
 * Convention: ship instances are named SHIP-<vesselCode> (e.g. SHIP-ALWK).
 * Anything else (SHORE, UNKNOWN, empty) is treated as shore.
 *
 * Two API surfaces:
 *   • isShipInstanceId(id)   — pure function, for callers that already have a
 *                               resolved instance ID (SyncEngine, FileSyncProcessor, etc.)
 *   • isShipInstance()       — async, resolves effective ID from DB + env,
 *                               for callers that don't (routes.ts, controller guards)
 *
 * Pattern: startsWith('SHIP-') with hyphen, case-insensitive.
 * This matches the SHIP-<vesselCode> naming convention and the canonical
 * instanceInfoHandler logic in controller.ts.
 */

import * as syncRepo from './repository';

// ── Pure function (synchronous) ──

/**
 * Check if a given instance ID represents a ship.
 * Standardized: case-insensitive startsWith('SHIP-') — with the hyphen.
 *
 * Use this when you already have the resolved instance ID (e.g. this.instanceId
 * in SyncEngine/FileSyncProcessor, or effectiveId in controller.ts).
 */
export function isShipInstanceId(instanceId: string): boolean {
  return instanceId.toUpperCase().startsWith('SHIP-');
}

// ── Async helpers (resolve effective ID from DB + env) ──

/**
 * Resolve the effective instance ID:
 *   1. DB sync_settings.instance_id (if set and non-empty)
 *   2. process.env.SYNC_INSTANCE_ID
 *   3. 'UNKNOWN'
 *
 * Mirrors the logic in controller.ts instanceInfoHandler.
 */
export async function getEffectiveInstanceId(): Promise<string> {
  let dbInstanceId: string | null = null;
  try {
    dbInstanceId = await syncRepo.getSetting('instance_id');
  } catch {
    // DB may not be available yet — fall through to env
  }
  return (dbInstanceId && dbInstanceId.trim()) || process.env.SYNC_INSTANCE_ID || 'UNKNOWN';
}

/**
 * Async: resolve effective instance ID, then check if it's a ship.
 * Use this when you don't already have a resolved instance ID.
 */
export async function isShipInstance(): Promise<boolean> {
  const id = await getEffectiveInstanceId();
  return isShipInstanceId(id);
}

/**
 * Returns 'ship' or 'shore'.
 */
export async function getInstanceRole(): Promise<'ship' | 'shore'> {
  return (await isShipInstance()) ? 'ship' : 'shore';
}

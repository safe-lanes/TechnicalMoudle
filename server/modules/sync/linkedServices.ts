// Linked services that sync before this module's Sync Now. My Files by default, on every ship: where it is not
// installed, Sync Now says so and skips it. LINKED_SYNC_SERVICES replaces the default per server ('[]' = none).
// Addresses only: no secret.
export const DEFAULT_LINKED_SYNC_SERVICES = [{ name: 'My Files', url: '/m/api/v1', enabled: true, timeoutMs: 180000 }];
export function linkedSyncServices(raw = process.env.LINKED_SYNC_SERVICES): unknown {
  if (!raw?.trim()) return DEFAULT_LINKED_SYNC_SERVICES;
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[Sync] LINKED_SYNC_SERVICES is not valid JSON: using the default');
    return DEFAULT_LINKED_SYNC_SERVICES;
  }
}

import type { CachedDryRunData } from '../services/types/strategyTypes';

const CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, CachedDryRunData>();

export function setCachedDryRun(fileToken: string, data: CachedDryRunData): void {
  data.createdAt = Date.now();
  cache.set(fileToken, data);
  cleanExpired();
}

export function getCachedDryRun(fileToken: string): CachedDryRunData | undefined {
  const entry = cache.get(fileToken);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(fileToken);
    return undefined;
  }
  return entry;
}

export function deleteCachedDryRun(fileToken: string): void {
  cache.delete(fileToken);
}

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.createdAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

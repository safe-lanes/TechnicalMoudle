// In-memory dry-run results cache
// In production, consider Redis or similar
export const dryRunCache = new Map<string, any>();

export function cleanExpiredCache(maxAgeMs = 3600000) {
  const cutoff = Date.now() - maxAgeMs;
  Array.from(dryRunCache.entries()).forEach(([key, value]) => {
    if (value.timestamp < cutoff) {
      dryRunCache.delete(key);
    }
  });
}

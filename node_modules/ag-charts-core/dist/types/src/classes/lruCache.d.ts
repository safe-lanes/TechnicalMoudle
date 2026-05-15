/**
 * Implements a most-recently-used caching strategy with a similar interface to Map.
 */
export declare class LRUCache<V, K = string> {
    private readonly maxCacheSize;
    private readonly store;
    constructor(maxCacheSize: number);
    get(key: K): NonNullable<V> | undefined;
    has(key: K): boolean;
    set(key: K, value: V): V;
    clear(): void;
}

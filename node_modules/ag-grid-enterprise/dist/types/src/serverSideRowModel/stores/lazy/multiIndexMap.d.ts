export declare class MultiIndexMap<K, I extends keyof K> {
    private indexes;
    private maps;
    constructor(...indexes: I[]);
    getSize(): number;
    getBy(index: I, key: any): K | undefined;
    set(item: K): void;
    delete(item: K): void;
    clear(): void;
    private getIterator;
    forEach(callback: (item: K) => void): void;
    find(callback: (item: K) => boolean): K | undefined;
    filter(predicate: (item: K) => boolean): K[];
}

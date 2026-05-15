export declare class StateTracker<T, K = string> extends Map<K, T> {
    protected readonly defaultValue?: T | undefined;
    protected readonly defaultState?: K | undefined;
    private cachedState?;
    private cachedValue?;
    constructor(defaultValue?: T | undefined, defaultState?: K | undefined);
    set(key: K, value?: T): this;
    delete(key: K): boolean;
    stateId(): K | undefined;
    stateValue(): T | undefined;
}

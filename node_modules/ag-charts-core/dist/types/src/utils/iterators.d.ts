/**
 * Yields items from multiple iterables in sequence. If a value is not iterable,
 * it is yielded directly.
 *
 * @param items - A list of iterable objects or values.
 * @returns A generator yielding all items from the input iterables, or the values themselves if not iterable.
 */
export declare function iterate<T extends any[]>(...items: T): Generator<T[number] extends Iterable<infer U> ? U : T[number], void, undefined>;
/**
 * Converts a value into an iterable. If the value is not already iterable, it wraps it in an array.
 * @param value - The value to convert.
 * @returns An iterable representing the value.
 */
export declare function toIterable<T>(value: T | Iterable<T>): Iterable<T>;
/**
 * Returns the first value from an iterable sequence.
 * @param iterable source of values
 * @returns The first value, or throws an error is there is no first value.
 */
export declare function first<T>(iterable: Iterable<T>): T | never;
/**
 * Efficient key/value iterator. Note that the returned tuple is always the same array, only
 * elements change from one iteration to the next, so should only be used in destructing for
 * statements.
 *
 * NOTE: For performance sensitive code, prefer using `Object.keys()` directly, or consider
 * using a `Map` instead.
 *
 * @param obj to iterate over
 * @returns An iterator for all key/value tuples of obj
 */
export declare function entries<T extends object>(obj: T): Iterable<[keyof T, T[keyof T]]>;

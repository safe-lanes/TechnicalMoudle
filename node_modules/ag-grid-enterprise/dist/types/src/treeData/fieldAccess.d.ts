export type DataFieldGetter<TData = any, TResult = unknown> = {
    (data: TData | null | undefined): TResult | null | undefined;
    path: string | null | undefined;
};
/**
 * Precompiles a field getter function for a given field path.
 * Note: the result should be cached, as it can be reused for multiple objects.
 * @param fieldPath The field path to compile, for example 'a.b.c'.
 * @returns A function that retrieves the value of the field from an object.
 */
export declare const makeFieldPathGetter: <TData = any, TResult = unknown>(fieldPath: string | null | undefined) => DataFieldGetter<TData, TResult>;

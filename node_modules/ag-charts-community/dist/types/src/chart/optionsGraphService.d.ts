import type { PlainObject } from 'ag-charts-core';
export type ResolvePartialCallback = (path: Array<string>, partialOptions?: PlainObject, resolveOptions?: ResolvePartialOpts) => Resolved;
type Resolved = Pick<PlainObject, string> | undefined;
type ResolvePartialOpts = {
    permissivePath?: boolean;
    pick?: boolean;
    proxyPaths?: Record<string, Array<string>>;
};
export declare class OptionsGraphService {
    private resolvePartialCallback?;
    updateCallback(resolvePartialCallback: ResolvePartialCallback): void;
    resolvePartial(path: Array<string>, partialOptions?: PlainObject, resolveOptions?: ResolvePartialOpts): Resolved;
}
export {};

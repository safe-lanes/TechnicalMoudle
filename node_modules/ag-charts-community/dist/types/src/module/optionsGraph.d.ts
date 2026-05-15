import { AdjacencyListGraph, type PlainObject, type Vertex } from 'ag-charts-core';
import type { ChartTheme } from '../chart/themes/chartTheme';
import { type PaletteType } from './coreModulesTypes';
import { type OptionsGraphInterface } from './optionsGraphUtils';
export declare const createOptionsGraph: (theme: ChartTheme, options: PlainObject) => OptionsGraph;
export declare function createOptionsGraphFn(theme: ChartTheme, options: PlainObject): OptionsGraph;
/**
 * The OptionsGraph combines the theme config, params, palette, overrides and user options into a graph which can then
 * be resolved down into an object.
 */
export declare class OptionsGraph extends AdjacencyListGraph<unknown, string> implements OptionsGraphInterface {
    private readonly config;
    private readonly userOptions;
    readonly palette: PlainObject;
    private readonly overrides;
    private readonly internalParams;
    private static readonly EDGE_PRIORITY;
    private static readonly GRAFT_EDGE;
    private static readonly SHALLOW_KEYS;
    private static readonly COMPLEX_KEYS;
    private static readonly ANNOTATIONS_OPTIONS_KEYS;
    private static readonly UNSAFE_CLEAR_KEYS;
    private static readonly valueCache;
    readonly paletteType: PaletteType;
    private edgePriority;
    private graftEdge;
    private root?;
    private params?;
    private annotations?;
    private resolved;
    private resolvedParams;
    private resolvedAnnotations;
    private readonly value$1;
    private readonly cachedPathVertices;
    private hasUnsafeClearKeys;
    private userPartialOptions?;
    private rollbackVertices;
    private rollbackEdgesFrom;
    private rollbackEdgesTo;
    private rollbackEdgesValue;
    private isRollingBack;
    constructor(config?: PlainObject, userOptions?: PlainObject, params?: PlainObject | undefined, palette?: PlainObject, overrides?: PlainObject | undefined, internalParams?: Map<unknown, unknown>);
    clear(): void;
    clearSafe(): void;
    resolve(): PlainObject;
    resolveParams(): PlainObject;
    resolveAnnotationThemes(): PlainObject;
    addVertex(value: unknown): Vertex<unknown, unknown>;
    addEdge(from: Vertex<unknown, unknown>, to: Vertex<unknown, unknown>, edge: string): void;
    /**
     * Resolve partial options against the existing graph at a given path without overriding the existing user values.
     * Returns an object with only those keys that were also present within `partialOptions`.
     */
    resolvePartial(path: Array<string>, partialOptions?: PlainObject, resolveOptions?: {
        permissivePath?: boolean;
        pick?: boolean;
        proxyPaths?: Record<string, Array<string>>;
    }): Pick<PlainObject, string> | undefined;
    findVertexAtPath(path: Array<string>): Vertex<unknown, unknown> | undefined;
    hasUserOption(path: Array<string>): boolean;
    /**
     * Get the value from the user options at the given path. This method is dangerous since it does not resolve
     * through the graph, however is useful for operations that operate on their own path where attempting to
     * resolve would cause an infinite loop.
     */
    dangerouslyGetUserOption(path: Array<string>): unknown;
    hasThemeOverride(path: Array<string>): boolean;
    getParamValue(path: string): any;
    getPathArray(vertex: Vertex<unknown>): Array<string>;
    getResolvedPath(path: Array<string>): unknown;
    getCachedValue(path: string[], key: string): unknown;
    setCachedValue(path: string[], key: string, value: unknown): void;
    prune(vertex: Vertex<unknown>, edges: Array<string>): void;
    resolveVertexValue(vertex: Vertex<unknown>, valueVertex: Vertex<unknown>): unknown;
    /**
     * Resolve the value currently referenced by `$1` by the nearest self-or-ancestor that has a defined value.
     */
    resolveValue$1(pathArray: Array<string>): {} | undefined;
    /**
     * Graft a branch of the theme config onto the target vertex.
     */
    graftConfig(target: Vertex<unknown>, configPathArray: Array<string>, ignorePaths: Set<string>): void;
    /**
     * Graft a given object onto the target vertex.
     */
    graftObject(target: Vertex<unknown>, object: PlainObject, overridesPathArrays?: Array<Array<string> | undefined>, edgeValue?: string): void;
    /**
     * Graft a given operation and value onto `path` child of the target vertex. The `ontoObject` value is built onto
     * the graph each time this function is called, at the given path, while `value` is used for value$1 where
     * `ontoObject` is an operation that invokes value$1.
     */
    graftValue(target: Vertex<unknown>, path: string, ontoObject: unknown, value: unknown, edgeValue?: string): void;
    /**
     * Resolve a branch as if it were a child of the context vertex, but without attaching it to the resolved root.
     */
    graftAndResolveOrphan(context: Vertex<unknown>, branch: Vertex<unknown>): unknown;
    private buildGraphFromObject;
    private buildGraphAutoEnable;
    private getVertexChildrenByKey;
    private buildGraphFromValue;
    private buildShallowGraphFromValue;
    private buildGraphFromOperation;
    private readonly EMPTY_PATH_ARRAY_VERTEX;
    private buildGraphFromOperationValue;
    /**
     * Add dependency edges on operations that require other vertices to be resolved before the operation can be
     * resolved. Then clear the list of pending edges.
     */
    private buildDependencyGraph;
    /**
     * Within the branch starting at the given vertex, reassign any value vertices and their operation key vertices to
     * the pending processing edges. These can then be built with `this.buildDependencyGraph()`.
     */
    private refreshPendingProcessingEdges;
    private resolveVertex;
    private resolveVertexInEdgePriority;
    private resolveVertexValueInternal;
    private resolveVertexAutoEnable;
    private resolveVertexChildren;
    private resolveVertexDependencies;
    private graftAndResolveChildren;
    private resolveValueOrSymbol;
    private snapshot;
    private rollback;
}

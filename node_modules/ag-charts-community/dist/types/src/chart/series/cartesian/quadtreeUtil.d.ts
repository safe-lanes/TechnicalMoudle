import { type Point } from 'ag-charts-core';
import type { Group } from '../../../scene/group';
import type { Node } from '../../../scene/node';
import type { QuadtreeNearest } from '../../../scene/util/quadtree';
import type { DistantObject } from '../../../util/nearest';
import type { SeriesNodePickMatch } from '../series';
import type { DatumIndexType, SeriesNodeDatum } from '../seriesTypes';
export type QuadtreeCompatibleNode = Node & DistantObject & {
    readonly midPoint: {
        x: number;
        y: number;
    };
};
export declare function addHitTestersToQuadtree<TNode extends QuadtreeCompatibleNode, TDatum extends SeriesNodeDatum<DatumIndexType>>(quadtree: QuadtreeNearest<TDatum>, hitTesters: Iterable<TNode>): void;
type SeriesWithQuadtreeNearest<TDatum extends SeriesNodeDatum<DatumIndexType>> = {
    readonly contentGroup: Group;
    getQuadTree(): QuadtreeNearest<TDatum>;
};
export declare function findQuadtreeMatch<TDatum extends SeriesNodeDatum<DatumIndexType>>(series: SeriesWithQuadtreeNearest<TDatum>, point: Point): SeriesNodePickMatch | undefined;
export {};

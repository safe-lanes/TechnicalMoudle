import type { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext, FibonacciBands } from '../annotationTypes';
export declare enum FibonacciNodeTag {
    OneLine = 0,
    HorizontalLine = 1
}
type FibonacciRangeLabel = _ModuleSupport.Vec4 & {
    text: string;
};
export interface FibonacciRangeDatum extends _ModuleSupport.Vec4 {
    id: any;
    tag: FibonacciNodeTag;
    label: FibonacciRangeLabel;
}
export declare function getFibonacciCoords(coords1: _ModuleSupport.Vec4, coords2?: _ModuleSupport.Vec4): {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
};
export declare function createFibonacciRangesData({ x1, y1, x2, y2 }: _ModuleSupport.Vec4, context: AnnotationContext, reverse: boolean, yZero: number, bands?: FibonacciBands): FibonacciRangeDatum[];
export {};

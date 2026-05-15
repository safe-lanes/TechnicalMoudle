import type { FillOptions, LineDashOptions, StrokeOptions } from 'ag-charts-types';
import { Path } from './path';
export interface ClipRect {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
export interface Segment extends StrokeOptions, FillOptions, LineDashOptions {
    clipRect: ClipRect;
}
export declare class SegmentedPath<D = any> extends Path<D> {
    segments?: Segment[];
    private readonly segmentPath;
    drawPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void;
}
export declare function rect(path: Path2D, { x0, y0, x1, y1 }: ClipRect, clockwise?: boolean): void;

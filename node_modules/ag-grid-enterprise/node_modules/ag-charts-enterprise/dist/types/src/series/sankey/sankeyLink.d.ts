import { _ModuleSupport } from 'ag-charts-community';
declare const Path: typeof _ModuleSupport.Path;
export declare class SankeyLink<D = any> extends Path<D> {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    height: number;
    inset: number;
    protected computeBBox(): _ModuleSupport.BBox | undefined;
    updatePath(): void;
}
export {};

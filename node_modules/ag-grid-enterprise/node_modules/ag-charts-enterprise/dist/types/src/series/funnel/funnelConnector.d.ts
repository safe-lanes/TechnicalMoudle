import { _ModuleSupport } from 'ag-charts-community';
declare const Path: typeof _ModuleSupport.Path;
export declare class FunnelConnector<D = any> extends Path<D> implements _ModuleSupport.DistantObject {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3: number;
    y3: number;
    get midPoint(): {
        x: number;
        y: number;
    };
    distanceSquared(x: number, y: number): number;
    protected computeBBox(): _ModuleSupport.BBox | undefined;
    updatePath(): void;
}
export {};

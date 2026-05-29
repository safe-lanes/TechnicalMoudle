import { _ModuleSupport } from 'ag-charts-community';
declare const Path: typeof _ModuleSupport.Path;
export declare class OhlcBaseNode<D = any> extends Path<D> implements _ModuleSupport.DistantObject {
    centerX: number;
    y: number;
    width: number;
    height: number;
    yOpen: number;
    yClose: number;
    crisp: boolean;
    strokeAlignment: number;
    protected computeBBox(): _ModuleSupport.BBox | undefined;
    isPointInPath(x: number, y: number): boolean;
    distanceSquared(x: number, y: number): number;
    get midPoint(): {
        x: number;
        y: number;
    };
    protected alignedCoordinates(): {
        centerX: number;
        x0: number;
        x1: number;
        y0: number;
        y1: number;
        yOpen: number;
        yClose: number;
    };
    protected executeStroke(ctx: _ModuleSupport.CanvasContext, path?: Path2D): void;
}
export declare class OhlcNode extends OhlcBaseNode {
    updatePath(): void;
}
export {};

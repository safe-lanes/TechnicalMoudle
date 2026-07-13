import { _ModuleSupport } from 'ag-charts-community';
export declare class RangeHandle extends _ModuleSupport.Path {
    static readonly className = "RangeHandle";
    zIndex: number;
    private centerX;
    private centerY;
    width: number;
    height: number;
    cornerRadius: number;
    grip: boolean;
    private readonly gripPath;
    setCenter(x: number, y: number): void;
    static align(minHandle: RangeHandle, maxHandle: RangeHandle, x: number, y: number, width: number, height: number, min: number, max: number, pixelAlign: number): void;
    protected computeBBox(): _ModuleSupport.BBox;
    isPointInPath(x: number, y: number): boolean;
    updatePath(): void;
    protected renderFill(ctx: _ModuleSupport.CanvasContext, path?: Path2D): void;
}

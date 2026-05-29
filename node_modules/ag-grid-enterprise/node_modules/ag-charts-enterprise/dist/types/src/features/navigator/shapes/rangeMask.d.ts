import { _ModuleSupport } from 'ag-charts-community';
declare const Path: typeof _ModuleSupport.Path;
export declare class RangeMask<D = any> extends Path<D> {
    static readonly className = "RangeMask";
    cornerRadius: number;
    zIndex: number;
    private x;
    private y;
    private width;
    private height;
    private min;
    private max;
    private readonly visiblePath;
    layout(x: number, y: number, width: number, height: number, min: number, max: number): void;
    protected computeBBox(): _ModuleSupport.BBox;
    computeVisibleRangeBBox(): _ModuleSupport.BBox;
    updatePath(): void;
    protected renderStroke(ctx: _ModuleSupport.CanvasContext, path?: Path2D): void;
}
export {};

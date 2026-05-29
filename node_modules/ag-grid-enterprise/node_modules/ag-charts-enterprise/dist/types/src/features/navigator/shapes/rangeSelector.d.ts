import { _ModuleSupport } from 'ag-charts-community';
export declare class RangeSelector extends _ModuleSupport.Group {
    private readonly background;
    private x;
    private y;
    private width;
    private height;
    private lOffset;
    private rOffset;
    constructor(children: _ModuleSupport.Node[]);
    layout(x: number, y: number, width: number, height: number, lOffset: number, rOffset: number): void;
    updateBackground(oldGroup?: _ModuleSupport.Group, newGroup?: _ModuleSupport.Group): void;
    protected computeBBox(): _ModuleSupport.BBox;
}

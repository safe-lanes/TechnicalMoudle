import { _ModuleSupport } from 'ag-charts-community';
import { MiniChart } from './miniChart';
import { type NavigatorButtonType } from './navigatorDOMProxy';
import { RangeHandle } from './shapes/rangeHandle';
import { RangeMask } from './shapes/rangeMask';
declare const BaseModuleInstance: typeof _ModuleSupport.BaseModuleInstance;
export declare class Navigator extends BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    private readonly ctx;
    miniChart?: MiniChart;
    enabled: boolean;
    mask: RangeMask<any>;
    minHandle: RangeHandle;
    maxHandle: RangeHandle;
    private readonly maskVisibleRange;
    height: number;
    cornerRadius: number;
    spacing: number;
    protected x: number;
    protected y: number;
    protected width: number;
    private readonly rangeSelector;
    private panStart?;
    private readonly domProxy;
    constructor(ctx: _ModuleSupport.ModuleContext);
    updateBackground(oldGroup?: _ModuleSupport.Group, newGroup?: _ModuleSupport.Group): void;
    private updateGroupVisibility;
    protected onLayoutStart(ctx: _ModuleSupport.LayoutContext): void;
    onLayoutComplete(opts: _ModuleSupport.LayoutCompleteEvent): void;
    private canDrag;
    onDragStart(dragging: NavigatorButtonType, { offsetX }: {
        offsetX: number;
    }): void;
    onDrag(dragging: NavigatorButtonType, { offsetX }: {
        offsetX: number;
    }): void;
    private onZoomChange;
    private layoutNodes;
    private updateZoom;
    updateData(data: any): void | undefined;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
}
export {};

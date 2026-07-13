import { _ModuleSupport } from 'ag-charts-community';
declare const BaseModuleInstance: typeof _ModuleSupport.BaseModuleInstance;
export declare const DEFAULT_ANNOTATION_AXIS_BUTTON_CLASS = "ag-charts-annotations__axis-button";
export declare class AxisButton extends BaseModuleInstance implements _ModuleSupport.ModuleInstance {
    private readonly ctx;
    private readonly axisCtx;
    private readonly onButtonClick;
    private seriesRect;
    enabled: boolean;
    private readonly button;
    private readonly snap;
    private padding;
    private coords?;
    constructor(ctx: _ModuleSupport.ModuleContext, axisCtx: _ModuleSupport.AxisContext & {
        snapToGroup: boolean;
    }, onButtonClick: (coords?: _ModuleSupport.Vec2) => void, seriesRect: _ModuleSupport.BBox);
    update(seriesRect: _ModuleSupport.BBox, padding: number): void;
    private setup;
    private destroyElements;
    private onMouseMove;
    private onMouseDrag;
    private onMouseLeave;
    private onClick;
    private show;
    private hide;
    private onKeyPress;
    private getButtonCoordinates;
    private toggleVisibility;
    private toggleClass;
    private updatePosition;
    private updateButtonElement;
}
export {};

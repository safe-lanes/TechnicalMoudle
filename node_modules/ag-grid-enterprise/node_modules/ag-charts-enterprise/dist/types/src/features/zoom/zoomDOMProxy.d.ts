import { _ModuleSupport, _Widget } from 'ag-charts-community';
import { type BaseStyleTypeMap } from 'ag-charts-core';
type AxesHandlers = {
    onAxisDragStart: (direction: _ModuleSupport.ChartAxisDirection) => void;
    onAxisDragMove: (id: string, direction: _ModuleSupport.ChartAxisDirection, event: _Widget.DragWidgetEvent<'drag-move'>) => void;
    onAxisDragEnd: () => void;
    onAxisDoubleClick: (id: string, direction: _ModuleSupport.ChartAxisDirection) => void;
    onAxisWheel: (id: string, direction: _ModuleSupport.ChartAxisDirection, event: _ModuleSupport.WheelWidgetEvent) => void;
};
export declare class ZoomDOMProxy {
    private readonly axesHandlers;
    private axes;
    private cursor;
    constructor(axesHandlers: AxesHandlers);
    destroy(): void;
    update(enableAxisDragging: boolean, enableAxisScrolling: boolean, ctx: _ModuleSupport.ModuleContext): void;
    setAxisCursor(cursor: BaseStyleTypeMap['cursor'] | undefined): void;
    toggleAxisDraggingCursor(direction: _ModuleSupport.ChartAxisDirection, enabled: boolean): void;
    private getCursor;
    private initAxis;
    private diffAxisIds;
}
export {};

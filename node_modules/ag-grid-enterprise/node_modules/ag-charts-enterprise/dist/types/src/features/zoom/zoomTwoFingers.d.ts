import type { _ModuleSupport, _Widget } from 'ag-charts-community';
type AxisZoomState = _ModuleSupport.AxisZoomState;
type DefinedZoomState = _ModuleSupport.DefinedZoomState;
export declare class ZoomTwoFingers {
    private readonly touchStart;
    private readonly initialZoom;
    private readonly previous;
    start(event: _Widget.TouchWidgetEvent<'touchstart'>, target: _Widget.Widget, zoom: AxisZoomState): boolean;
    update(event: _Widget.TouchWidgetEvent<'touchmove'>, target: _Widget.Widget): DefinedZoomState;
    end(event: _Widget.TouchWidgetEvent<'touchend' | 'touchcancel'>): boolean;
    private twitchTolerantZoomPan4;
}
export {};

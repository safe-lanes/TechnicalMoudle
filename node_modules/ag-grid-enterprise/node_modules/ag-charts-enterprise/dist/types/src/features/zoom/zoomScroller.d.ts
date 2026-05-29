import { _ModuleSupport, _Widget } from 'ag-charts-community';
import type { AxisZoomStates, DefinedZoomState, ZoomProperties } from './zoomTypes';
export declare class ZoomScroller {
    updateAxes(event: _Widget.WheelWidgetEvent, props: ZoomProperties, bbox: _ModuleSupport.BBox, zooms: AxisZoomStates): AxisZoomStates;
    update(event: _Widget.WheelWidgetEvent, props: ZoomProperties, bbox: _ModuleSupport.BBox, oldZoom: DefinedZoomState): DefinedZoomState | undefined;
    updateDelta(delta: number, props: ZoomProperties, oldZoom: DefinedZoomState): DefinedZoomState;
}

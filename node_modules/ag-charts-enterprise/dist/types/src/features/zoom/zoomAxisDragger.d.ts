import type { AgZoomAnchorPoint } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
export declare class ZoomAxisDragger {
    private coords?;
    private oldZoom?;
    update(event: {
        offsetX: number;
        offsetY: number;
    }, direction: _ModuleSupport.ChartAxisDirection, anchor: AgZoomAnchorPoint, bbox: _ModuleSupport.BBox, zoom?: _ModuleSupport.AxisZoomState, axisZoom?: _ModuleSupport.ZoomState): _ModuleSupport.ZoomState;
    stop(): void;
    private updateCoords;
    private updateZoom;
}

import { _ModuleSupport } from 'ag-charts-community';
import type { AxisZoomStates } from './zoomTypes';
export declare class ZoomScrollPanner {
    update(event: {
        deltaX: number;
    }, step: number, bbox: _ModuleSupport.BBox, zooms: AxisZoomStates): AxisZoomStates;
    private translateZooms;
}

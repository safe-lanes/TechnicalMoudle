import { _ModuleSupport } from 'ag-charts-community';
import type { AxisZoomStates } from './zoomTypes';
export interface ZoomPanUpdate {
    type: 'update';
    deltaX: number;
    deltaY: number;
}
declare const decelerationValues: {
    off: number;
    short: number;
    long: number;
};
export declare class ZoomPanner {
    deceleration: number | keyof typeof decelerationValues;
    private get decelerationValue();
    private onUpdate;
    private coords?;
    private direction?;
    private coordsMonitorTimeout;
    private zoomCoordsHistoryIndex;
    private readonly coordsHistory;
    private inertiaHandle;
    addListener(_type: 'update', fn: (e: ZoomPanUpdate) => void): () => void;
    stopInteractions(): void;
    update(event: {
        currentX: number;
        currentY: number;
    }): void;
    start(direction?: _ModuleSupport.ChartAxisDirection): void;
    stop(): void;
    private recordCurrentZoomCoords;
    private animateInertia;
    private updateCoords;
    private isPanningX;
    private isPanningY;
    translateZooms(bbox: _ModuleSupport.BBox, currentZooms: AxisZoomStates, deltaX: number, deltaY: number): AxisZoomStates;
}
export {};

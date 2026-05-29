import type { _ModuleSupport } from 'ag-charts-community';
import type { ZoomRect } from './scenes/zoomRect';
import type { DefinedZoomState, ZoomProperties } from './zoomTypes';
export declare class ZoomSelector {
    private readonly rect;
    private readonly getZoom;
    private readonly isZoomValid;
    private coords?;
    constructor(rect: ZoomRect, getZoom: () => DefinedZoomState, isZoomValid: (zoom: DefinedZoomState) => boolean);
    update(event: {
        currentX: number;
        currentY: number;
    }, props: ZoomProperties, bbox?: _ModuleSupport.BBox): void;
    stop(innerBBox?: _ModuleSupport.BBox, bbox?: _ModuleSupport.BBox, currentZoom?: _ModuleSupport.AxisZoomState): DefinedZoomState;
    reset(): void;
    didUpdate(): boolean;
    private updateCoords;
    private updateRect;
    private createZoomFromCoords;
    private getNormalisedDimensions;
}

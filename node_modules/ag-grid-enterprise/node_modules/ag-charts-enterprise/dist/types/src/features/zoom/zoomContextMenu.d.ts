import type { _ModuleSupport } from 'ag-charts-community';
import type { DefinedZoomState, ZoomProperties } from './zoomTypes';
export declare class ZoomContextMenu {
    private readonly eventsHub;
    private readonly contextMenuRegistry;
    private readonly zoomManager;
    private readonly getModuleProperties;
    private readonly canResetZoom;
    private readonly getRect;
    private readonly updateZoom;
    private readonly isZoomValid;
    constructor(eventsHub: _ModuleSupport.EventsHub, contextMenuRegistry: _ModuleSupport.ContextMenuRegistry, zoomManager: _ModuleSupport.ZoomManager, getModuleProperties: () => ZoomProperties, canResetZoom: () => boolean, getRect: () => _ModuleSupport.BBox | undefined, updateZoom: (zoom: DefinedZoomState) => void, isZoomValid: (zoom: DefinedZoomState) => boolean);
    registerActions(enabled: boolean | undefined): (() => void) | undefined;
    private computeOrigin;
    private onZoomToHere;
    private onPanToHere;
    private onResetZoom;
    private iterateFindNextZoomAtPoint;
    private getNextZoomAtPoint;
}

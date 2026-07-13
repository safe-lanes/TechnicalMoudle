import { type AgZoomAnchorPoint, _ModuleSupport } from 'ag-charts-community';
import type { DefinedZoomState, ZoomProperties } from './zoomTypes';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties, ToolbarButtonProperties: typeof _ModuleSupport.ToolbarButtonProperties;
declare class ZoomButtonProperties extends ToolbarButtonProperties {
    value: 'reset' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-start' | 'pan-end';
    section: string;
}
type ZoomButtonsVisible = 'always' | 'zoomed' | 'hover';
export declare class ZoomToolbar extends BaseProperties {
    private readonly ctx;
    private readonly getModuleProperties;
    private readonly canResetZoom;
    private readonly updateZoom;
    private readonly updateAxisZoom;
    private readonly resetZoom;
    private readonly isZoomValid;
    enabled?: boolean;
    buttons: _ModuleSupport.PropertiesArray<ZoomButtonProperties>;
    visible: ZoomButtonsVisible;
    anchorPointX?: AgZoomAnchorPoint;
    anchorPointY?: AgZoomAnchorPoint;
    private readonly verticalSpacing;
    private readonly detectionRange;
    private readonly container;
    private readonly toolbar;
    private readonly cleanup;
    private previousZoom?;
    constructor(ctx: _ModuleSupport.ModuleContext, getModuleProperties: () => ZoomProperties, canResetZoom: (zoom: Readonly<DefinedZoomState>) => boolean, updateZoom: (zoom: DefinedZoomState) => void, updateAxisZoom: (axisId: string, direction: _ModuleSupport.CartesianAxisDirection, partialZoom: _ModuleSupport.ZoomState | undefined) => void, resetZoom: () => void, isZoomValid: (zoom: DefinedZoomState) => boolean);
    destroy(): void;
    toggleVisibleZoomed(isMaxZoom: boolean): void;
    private teardown;
    private onLayoutComplete;
    private onHover;
    private onLeave;
    private toggleVisibility;
    private toggleButtons;
    private onButtonPress;
    private onButtonFocus;
    private onButtonPressAxis;
    private onButtonPressUnified;
    private getNextZoomStateUnified;
    private getAnchorPointX;
    private getAnchorPointY;
}
export {};

import { _ModuleSupport } from 'ag-charts-community';
import { type BoxBounds } from 'ag-charts-core';
export type NavigatorButtonType = 'min' | 'max' | 'pan';
type SliderDragHandlers = {
    onDragStart(type: NavigatorButtonType, event: {
        offsetX: number;
    }): void;
    onDrag(type: NavigatorButtonType, event: {
        offsetX: number;
    }): void;
};
type NavigatorDOMProxyModuleContext = Pick<_ModuleSupport.ModuleContext, 'zoomManager' | 'proxyInteractionService' | 'localeManager' | 'contextMenuRegistry'>;
export declare class NavigatorDOMProxy {
    private readonly ctx;
    private readonly sliderHandlers;
    _min: number;
    _max: number;
    readonly minRange = 0.001;
    private dragStartX;
    private readonly toolbar;
    private readonly sliders;
    constructor(ctx: NavigatorDOMProxyModuleContext, sliderHandlers: SliderDragHandlers);
    destroy(): void;
    updateVisibility(visible: boolean): void;
    updateZoom(): void;
    updateBounds(bounds: BoxBounds): void;
    updateSliderBounds(sliderIndex: number, bounds: BoxBounds): void;
    updateMinMax(min: number, max: number): void;
    private updateSliderRatios;
    private toCanvasOffsets;
    private moveToFront;
    private onDragStart;
    private onDrag;
    private onContextMenu;
    private onPanSliderChange;
    private onMinSliderChange;
    private onMaxSliderChange;
}
export {};

import { _ModuleSupport } from 'ag-charts-community';
import { EventEmitter } from 'ag-charts-core';
import { type AnnotationType } from './annotationTypes';
declare const ToolbarButtonProperties: typeof _ModuleSupport.ToolbarButtonProperties;
interface EventMap {
    'cancel-create-annotation': null;
    'pressed-create-annotation': {
        annotation: AnnotationType;
    };
    'pressed-clear': null;
    'pressed-show-menu': null;
    'pressed-unrelated': null;
}
type AnnotationsToolbarButtonValue = 'line-menu' | 'fibonacci-menu' | 'text-menu' | 'shape-menu' | 'measurer-menu' | 'clear';
declare class AnnotationsToolbarButtonProperties extends ToolbarButtonProperties {
    value: AnnotationsToolbarButtonValue;
}
export declare class AnnotationsToolbar extends _ModuleSupport.BaseProperties {
    private readonly ctx;
    enabled?: boolean;
    /**
     * The padding between the toolbar and the chart area.
     */
    padding: number;
    buttons: _ModuleSupport.PropertiesArray<AnnotationsToolbarButtonProperties>;
    readonly events: EventEmitter<EventMap>;
    private readonly toolbar;
    private readonly annotationMenu;
    private readonly cleanup;
    constructor(ctx: _ModuleSupport.ModuleContext);
    destroy(): void;
    toggleClearButtonEnabled(enabled: boolean): void;
    resetButtonIcons(): void;
    hideOverlays(): void;
    clearActiveButton(): void;
    private onLayoutStart;
    refreshButtonsEnabled(enabled: boolean): void;
    private onToolbarButtonPress;
    private onToolbarButtonPressShowMenu;
    private onButtonPressMenuCreateAnnotation;
    private onKeyDown;
    private updateButtonByIndex;
}
export {};

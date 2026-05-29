import { type AgAnnotationLineStyleType, _ModuleSupport } from 'ag-charts-community';
import { EventEmitter } from 'ag-charts-core';
import { type AnnotationOptionsColorPickerType, type HasColorAnnotationType, type HasFontSizeAnnotationType, type HasLineStyleAnnotationType } from './annotationTypes';
import { AnnotationOptions } from './annotationsMenuOptions';
import type { AnnotationProperties, AnnotationScene } from './annotationsSuperTypes';
declare const ToolbarButtonProperties: typeof _ModuleSupport.ToolbarButtonProperties;
interface EventMap {
    'pressed-delete': null;
    'pressed-settings': {
        sourceEvent: Event;
    };
    'pressed-lock': null;
    'hid-overlays': null;
    'saved-color': {
        type: HasColorAnnotationType;
        colorPickerType: AnnotationOptionsColorPickerType;
        color: string | undefined;
    };
    'updated-color': {
        type: HasColorAnnotationType;
        colorPickerType: AnnotationOptionsColorPickerType;
        colorOpacity: string;
        color: string;
        opacity: number;
        isMultiColor: boolean;
    };
    'updated-font-size': {
        type: HasFontSizeAnnotationType;
        fontSize: number;
    };
    'updated-line-style': {
        type: HasLineStyleAnnotationType;
        lineStyleType: AgAnnotationLineStyleType;
    };
    'updated-line-width': {
        type: HasLineStyleAnnotationType;
        strokeWidth: number;
    };
}
declare class AnnotationOptionsButtonProperties extends ToolbarButtonProperties {
    value: AnnotationOptions;
    checkedOverrides: _ModuleSupport.ToolbarButtonProperties;
    color?: string;
    strokeWidth?: number;
    isMultiColor?: boolean;
}
export declare class AnnotationOptionsToolbar extends _ModuleSupport.BaseProperties {
    private readonly ctx;
    private readonly getActiveDatum;
    enabled?: boolean;
    buttons: _ModuleSupport.PropertiesArray<AnnotationOptionsButtonProperties>;
    private readonly cleanup;
    readonly events: EventEmitter<EventMap>;
    private visibleButtons;
    private readonly toolbar;
    private readonly colorPicker;
    private readonly textSizeMenu;
    private readonly lineStyleTypeMenu;
    private readonly lineStrokeWidthMenu;
    constructor(ctx: _ModuleSupport.ModuleContext, getActiveDatum: () => AnnotationProperties | undefined);
    private onDragStart;
    private onDragEnd;
    destroy(): void;
    show(): void;
    hide(): void;
    updateButtons(datum: AnnotationProperties): void;
    setAnchorScene(scene: AnnotationScene): void;
    hideOverlays(): void;
    clearActiveButton(): void;
    private updateColors;
    updateColorPickerColor(colorPickerType: AnnotationOptionsColorPickerType, color?: string, opacity?: number, isMultiColor?: boolean): void;
    private updateFontSize;
    updateLineStyleType(item: _ModuleSupport.MenuItem<AgAnnotationLineStyleType>): void;
    updateStrokeWidth(item: _ModuleSupport.MenuItem<number>): void;
    private onButtonPress;
    private onToolbarMoved;
    private onColorPickerChange;
    private onTextSizeMenuPress;
    private onLineStyleTypeMenuPress;
    private onLineStrokeWidthMenuPress;
    private refreshButtons;
    private updateLineStyles;
    private updateButtonByValue;
    private updateButtonByIndex;
}
export {};

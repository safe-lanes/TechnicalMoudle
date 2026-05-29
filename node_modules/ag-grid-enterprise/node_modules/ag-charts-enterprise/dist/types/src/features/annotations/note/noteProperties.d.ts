import { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationContext, type AnnotationOptionsColorPickerType, AnnotationType, type Padding } from '../annotationTypes';
import { TextualPointProperties } from '../properties/textualPointProperties';
export declare const ICON_HEIGHT = 20;
export declare const ICON_WIDTH = 22;
export declare const LABEL_OFFSET: number;
export declare const TOOLBAR_OFFSET = 34;
declare const NoteBackgroundProperties_base: {
    new (...args: any[]): {
        fill?: string | undefined;
        fillOpacity?: number | undefined;
    };
} & {
    new (...args: any[]): {
        stroke?: string | undefined;
        strokeOpacity?: number | undefined;
        strokeWidth?: number | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
declare class NoteBackgroundProperties extends NoteBackgroundProperties_base {
}
declare const NoteProperties_base: {
    new (...args: any[]): {
        fill?: string | undefined;
        fillOpacity?: number | undefined;
    };
} & {
    new (...args: any[]): {
        stroke?: string | undefined;
        strokeOpacity?: number | undefined;
        strokeWidth?: number | undefined;
    };
} & typeof TextualPointProperties;
export declare class NoteProperties extends NoteProperties_base {
    static is(this: void, value: unknown): value is NoteProperties;
    type: AnnotationType.Note;
    background: NoteBackgroundProperties;
    position: 'bottom' | 'top';
    alignment: "center";
    width: number;
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(colorPickerType: AnnotationOptionsColorPickerType): number | undefined;
    getPadding(): Padding;
    getTextInputCoords(context: AnnotationContext, height: number): {
        x: number;
        y: number;
    };
}
export {};

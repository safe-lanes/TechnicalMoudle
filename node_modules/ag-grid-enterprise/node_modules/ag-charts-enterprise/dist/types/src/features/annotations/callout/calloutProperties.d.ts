import { type AnnotationContext, type AnnotationOptionsColorPickerType, AnnotationType, type Padding } from '../annotationTypes';
import { TextualStartEndProperties } from '../properties/textualStartEndProperties';
declare const CalloutProperties_base: {
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
} & typeof TextualStartEndProperties;
export declare class CalloutProperties extends CalloutProperties_base {
    static is(this: void, value: unknown): value is CalloutProperties;
    type: AnnotationType.Callout;
    position: "bottom";
    alignment: "left";
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(colorPickerType: AnnotationOptionsColorPickerType): number | undefined;
    getPlaceholderColor(): string;
    getPadding(): Padding;
    getTextInputCoords(context: AnnotationContext, height: number): {
        x: number;
        y: number;
    };
}
export {};

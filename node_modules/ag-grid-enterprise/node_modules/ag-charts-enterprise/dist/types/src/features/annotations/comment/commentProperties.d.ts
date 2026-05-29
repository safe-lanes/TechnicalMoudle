import { type AnnotationContext, type AnnotationOptionsColorPickerType, AnnotationType, type Padding } from '../annotationTypes';
import { TextualPointProperties } from '../properties/textualPointProperties';
declare const CommentProperties_base: {
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
export declare class CommentProperties extends CommentProperties_base {
    static is(this: void, value: unknown): value is CommentProperties;
    type: AnnotationType.Comment;
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

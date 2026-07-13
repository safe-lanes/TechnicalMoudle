import { type AnnotationContext, type AnnotationOptionsColorPickerType, type Padding } from '../annotationTypes';
import type { AnnotationTextAlignment, AnnotationTextPosition } from '../text/util';
import { StartEndProperties } from './startEndProperties';
declare const TextualStartEndProperties_base: {
    new (...args: any[]): {
        localeManager?: import("packages/ag-charts-community/dist/types/src/locale/localeManager").LocaleManager | undefined;
        setLocaleManager(localeManager: import("packages/ag-charts-community/dist/types/src/locale/localeManager").LocaleManager): void;
    };
} & {
    new (...args: any[]): {
        padding?: number | undefined;
        textAlign: import("ag-charts-community").TextAlign;
        formatter?: import("ag-charts-community").Formatter<import("../annotationProperties").AxisLabelFormatterParams> | undefined;
    };
} & {
    new (...args: any[]): {
        fontStyle?: import("ag-charts-community").FontStyle | undefined;
        fontWeight?: import("ag-charts-community").FontWeight | undefined;
        fontSize: number;
        fontFamily: string;
        color?: string | undefined;
    };
} & typeof StartEndProperties;
export declare class TextualStartEndProperties extends TextualStartEndProperties_base {
    text: string;
    position: AnnotationTextPosition;
    alignment: AnnotationTextAlignment;
    placement: 'inside' | 'outside';
    width?: number;
    placeholderText?: string;
    getDefaultColor(_colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(_colorPickerType: AnnotationOptionsColorPickerType): number | undefined;
    getPlaceholderColor(): string | undefined;
    getPadding(): Padding;
    getText(): {
        text: string;
        isPlaceholder: boolean;
    };
    getTextInputCoords(context: AnnotationContext, _height: number): {
        x: number;
        y: number;
    };
    getTextPosition(): AnnotationTextPosition;
}
export {};

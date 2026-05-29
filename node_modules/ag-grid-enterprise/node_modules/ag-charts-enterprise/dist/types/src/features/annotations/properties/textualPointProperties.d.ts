import { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationContext, type AnnotationOptionsColorPickerType, type Padding } from '../annotationTypes';
import type { AnnotationTextAlignment, AnnotationTextPosition } from '../text/util';
declare const TextualPointProperties_base: (abstract new (...args: any[]) => {
    id: string;
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType, isMultiColor?: boolean | undefined): string | undefined;
    locked?: boolean | undefined;
    visible?: boolean | undefined;
    handleUnknownProperties(_unknownKeys: Set<unknown>, _properties: object): void;
    set(properties: object): any;
    clear(): any;
    toJson<J>(this: J): object;
}) & {
    new (...args: any[]): {
        x?: import("../utils/scale").PointType;
        y?: import("../utils/scale").PointType;
    };
} & {
    new (...args: any[]): {
        handle: {
            stroke?: string | undefined;
            strokeOpacity?: number | undefined;
            strokeWidth?: number | undefined;
            lineCap?: _ModuleSupport.ShapeLineCap | undefined;
            computedLineDash?: number[] | undefined;
            lineDash?: number[] | undefined;
            lineDashOffset?: number | undefined;
            lineStyle?: import("ag-charts-community").AgAnnotationLineStyleType | undefined;
            fill?: string | undefined;
            fillOpacity?: number | undefined;
            handleUnknownProperties(_unknownKeys: Set<unknown>, _properties: object): void;
            set(properties: object): any;
            clear(): any;
            toJson<J>(this: J): object;
        };
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
} & typeof _ModuleSupport.BaseProperties;
export declare class TextualPointProperties extends TextualPointProperties_base {
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

import { type PixelSize, _ModuleSupport } from 'ag-charts-community';
import { LineTextProperties } from '../annotationProperties';
import { AnnotationType } from '../annotationTypes';
declare const HorizontalLineProperties_base: (abstract new (...args: any[]) => {
    id: string;
    getDefaultColor(colorPickerType: import("../annotationTypes").AnnotationOptionsColorPickerType, isMultiColor?: boolean | undefined): string | undefined;
    locked?: boolean | undefined;
    visible?: boolean | undefined;
    handleUnknownProperties(_unknownKeys: Set<unknown>, _properties: object): void;
    set(properties: object): any;
    clear(): any;
    toJson<J>(this: J): object;
}) & {
    new (...args: any[]): {
        value?: import("../utils/scale").PointType;
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
        axisLabel: import("../annotationProperties").AxisLabelProperties;
    };
} & {
    new (...args: any[]): {
        stroke?: string | undefined;
        strokeOpacity?: number | undefined;
        strokeWidth?: number | undefined;
    };
} & {
    new (...args: any[]): {
        lineCap?: _ModuleSupport.ShapeLineCap | undefined;
        computedLineDash?: number[] | undefined;
        lineDash?: number[] | undefined;
        lineDashOffset?: number | undefined;
        lineStyle?: import("ag-charts-community").AgAnnotationLineStyleType | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
export declare class HorizontalLineProperties extends HorizontalLineProperties_base {
    readonly direction = "horizontal";
    static is(this: void, value: unknown): value is HorizontalLineProperties;
    type: AnnotationType.HorizontalLine;
    text: LineTextProperties;
    getDefaultColor(): string | undefined;
    getDefaultOpacity(): number | undefined;
    getLineDash(): PixelSize[] | undefined;
    getLineCap(): _ModuleSupport.ShapeLineCap | undefined;
}
declare const VerticalLineProperties_base: (abstract new (...args: any[]) => {
    id: string;
    getDefaultColor(colorPickerType: import("../annotationTypes").AnnotationOptionsColorPickerType, isMultiColor?: boolean | undefined): string | undefined;
    locked?: boolean | undefined;
    visible?: boolean | undefined;
    handleUnknownProperties(_unknownKeys: Set<unknown>, _properties: object): void;
    set(properties: object): any;
    clear(): any;
    toJson<J>(this: J): object;
}) & {
    new (...args: any[]): {
        value?: import("../utils/scale").PointType;
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
        axisLabel: import("../annotationProperties").AxisLabelProperties;
    };
} & {
    new (...args: any[]): {
        stroke?: string | undefined;
        strokeOpacity?: number | undefined;
        strokeWidth?: number | undefined;
    };
} & {
    new (...args: any[]): {
        lineCap?: _ModuleSupport.ShapeLineCap | undefined;
        computedLineDash?: number[] | undefined;
        lineDash?: number[] | undefined;
        lineDashOffset?: number | undefined;
        lineStyle?: import("ag-charts-community").AgAnnotationLineStyleType | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
export declare class VerticalLineProperties extends VerticalLineProperties_base {
    readonly direction = "vertical";
    static is(this: void, value: unknown): value is VerticalLineProperties;
    type: AnnotationType.VerticalLine;
    text: LineTextProperties;
    getDefaultColor(): string | undefined;
    getDefaultOpacity(): number | undefined;
    getLineDash(): PixelSize[] | undefined;
    getLineCap(): _ModuleSupport.ShapeLineCap | undefined;
}
export type CrossLineProperties = HorizontalLineProperties | VerticalLineProperties;
export {};

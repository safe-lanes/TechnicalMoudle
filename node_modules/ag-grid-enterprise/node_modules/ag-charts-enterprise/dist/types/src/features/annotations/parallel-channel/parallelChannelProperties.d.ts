import { type PixelSize, _ModuleSupport } from 'ag-charts-community';
import { ChannelAnnotationMiddleProperties, ChannelTextProperties } from '../annotationProperties';
import { type AnnotationOptionsColorPickerType, AnnotationType } from '../annotationTypes';
declare const ParallelChannelProperties_base: (abstract new (...args: any[]) => {
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
        background: {
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
        start: import("../annotationProperties").PointProperties;
        end: import("../annotationProperties").PointProperties;
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
        extendStart?: boolean | undefined;
        extendEnd?: boolean | undefined;
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
export declare class ParallelChannelProperties extends ParallelChannelProperties_base {
    static is(this: void, value: unknown): value is ParallelChannelProperties;
    type: AnnotationType.ParallelChannel;
    height: number;
    middle: ChannelAnnotationMiddleProperties;
    text: ChannelTextProperties;
    snapToAngle: number;
    get bottom(): {
        start: {
            x: import("../utils/scale").PointType;
            y: import("../utils/scale").PointType;
        };
        end: {
            x: import("../utils/scale").PointType;
            y: import("../utils/scale").PointType;
        };
    };
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(colorPickerType: AnnotationOptionsColorPickerType): number | undefined;
    getLineDash(): PixelSize[] | undefined;
    getLineCap(): _ModuleSupport.ShapeLineCap | undefined;
}
export {};

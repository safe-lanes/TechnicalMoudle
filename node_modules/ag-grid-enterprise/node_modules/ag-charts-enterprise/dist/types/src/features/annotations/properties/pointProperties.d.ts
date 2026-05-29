import { _ModuleSupport } from 'ag-charts-community';
import { type AnnotationOptionsColorPickerType } from '../annotationTypes';
declare const PointProperties_base: (abstract new (...args: any[]) => {
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
} & typeof _ModuleSupport.BaseProperties;
export declare class PointProperties extends PointProperties_base {
    getDefaultColor(_colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(_colorPickerType: AnnotationOptionsColorPickerType): number | undefined;
}
export {};

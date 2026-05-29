import type { AgAnnotationLineStyleType, FontStyle, FontWeight, Formatter, TextAlign } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationOptionsColorPickerType, ChannelTextPosition, Constructor, LineTextAlignment, LineTextPosition } from './annotationTypes';
import type { PointType } from './utils/scale';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
/**************
 * Components *
 **************/
export declare class PointProperties extends BaseProperties {
    x?: PointType;
    y?: PointType;
}
declare const ChannelAnnotationMiddleProperties_base: {
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
        lineStyle?: AgAnnotationLineStyleType | undefined;
    };
} & {
    new (...args: any[]): {
        visible?: boolean | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
export declare class ChannelAnnotationMiddleProperties extends ChannelAnnotationMiddleProperties_base {
}
declare const AxisLabelProperties_base: {
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
        lineStyle?: AgAnnotationLineStyleType | undefined;
    };
} & {
    new (...args: any[]): {
        fill?: string | undefined;
        fillOpacity?: number | undefined;
    };
} & {
    new (...args: any[]): {
        padding?: number | undefined;
        textAlign: TextAlign;
        formatter?: Formatter<AxisLabelFormatterParams> | undefined;
    };
} & {
    new (...args: any[]): {
        fontStyle?: FontStyle | undefined;
        fontWeight?: FontWeight | undefined;
        fontSize: number;
        fontFamily: string;
        color?: string | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
export declare class AxisLabelProperties extends AxisLabelProperties_base {
    enabled?: boolean;
    cornerRadius: number;
}
declare const BackgroundProperties_base: {
    new (...args: any[]): {
        fill?: string | undefined;
        fillOpacity?: number | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
declare class BackgroundProperties extends BackgroundProperties_base {
}
declare const HandleProperties_base: {
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
        lineStyle?: AgAnnotationLineStyleType | undefined;
    };
} & {
    new (...args: any[]): {
        fill?: string | undefined;
        fillOpacity?: number | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
declare class HandleProperties extends HandleProperties_base {
}
declare const LineTextProperties_base: {
    new (...args: any[]): {
        fontStyle?: FontStyle | undefined;
        fontWeight?: FontWeight | undefined;
        fontSize: number;
        fontFamily: string;
        color?: string | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
export declare class LineTextProperties extends LineTextProperties_base {
    label: string;
    position?: LineTextPosition;
    alignment?: LineTextAlignment;
}
declare const LabelTextProperties_base: {
    new (...args: any[]): {
        fontStyle?: FontStyle | undefined;
        fontWeight?: FontWeight | undefined;
        fontSize: number;
        fontFamily: string;
        color?: string | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
export declare class LabelTextProperties extends LabelTextProperties_base {
}
declare const ChannelTextProperties_base: {
    new (...args: any[]): {
        fontStyle?: FontStyle | undefined;
        fontWeight?: FontWeight | undefined;
        fontSize: number;
        fontFamily: string;
        color?: string | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
export declare class ChannelTextProperties extends ChannelTextProperties_base {
    label: string;
    position?: ChannelTextPosition;
    alignment?: LineTextAlignment;
}
export interface AxisLabelFormatterParams {
    readonly value: any;
}
/*******************************
 * Annotations specific mixins *
 *******************************/
export declare function Annotation<U extends Constructor<_ModuleSupport.BaseProperties>>(Parent: U): (abstract new (...args: any[]) => {
    id: string;
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType, isMultiColor?: boolean): string | undefined;
    locked?: boolean | undefined;
    visible?: boolean | undefined;
    handleUnknownProperties(_unknownKeys: Set<unknown>, _properties: object): void;
    set(properties: object): any;
    clear(): any;
    toJson<J>(this: J): object;
}) & U;
export declare function Line<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        start: PointProperties;
        end: PointProperties;
    };
} & T;
export declare function Point<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        x?: PointType;
        y?: PointType;
    };
} & T;
export declare function Value<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        value?: PointType;
    };
} & T;
export declare function Background<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        background: BackgroundProperties;
    };
} & T;
export declare function Handle<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        handle: HandleProperties;
    };
} & T;
export declare function AxisLabel<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        axisLabel: AxisLabelProperties;
    };
} & T;
export declare function Label<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        padding?: number | undefined;
        textAlign: TextAlign;
        formatter?: Formatter<AxisLabelFormatterParams> | undefined;
    };
} & T;
export declare function Cappable<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        startCap?: "arrow" | undefined;
        endCap?: "arrow" | undefined;
    };
} & T;
export declare function Extendable<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        extendStart?: boolean | undefined;
        extendEnd?: boolean | undefined;
    };
} & T;
export declare function Localisable<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        localeManager?: import("packages/ag-charts-community/dist/types/src/locale/localeManager").LocaleManager | undefined;
        setLocaleManager(localeManager: _ModuleSupport.ModuleContext['localeManager']): void;
    };
} & T;
export declare function Fill<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        fill?: string | undefined;
        fillOpacity?: number | undefined;
    };
} & T;
export declare function Stroke<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        stroke?: string | undefined;
        strokeOpacity?: number | undefined;
        strokeWidth?: number | undefined;
    };
} & T;
export declare function LineStyle<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        lineCap?: _ModuleSupport.ShapeLineCap | undefined;
        computedLineDash?: number[] | undefined;
        lineDash?: number[] | undefined;
        lineDashOffset?: number | undefined;
        lineStyle?: AgAnnotationLineStyleType | undefined;
    };
} & T;
export declare function Font<T extends Constructor>(Parent: T): {
    new (...args: any[]): {
        fontStyle?: FontStyle | undefined;
        fontWeight?: FontWeight | undefined;
        fontSize: number;
        fontFamily: string;
        color?: string | undefined;
    };
} & T;
export {};

import { type PixelSize, _ModuleSupport } from 'ag-charts-community';
import { LineTextProperties } from '../annotationProperties';
import { type AnnotationOptionsColorPickerType, AnnotationType, type Point } from '../annotationTypes';
import { StartEndProperties } from '../properties/startEndProperties';
declare const MeasurerStatisticsDivider_base: {
    new (...args: any[]): {
        stroke?: string | undefined;
        strokeOpacity?: number | undefined;
        strokeWidth?: number | undefined;
    };
} & typeof _ModuleSupport.BaseProperties;
declare class MeasurerStatisticsDivider extends MeasurerStatisticsDivider_base {
}
declare const MeasurerStatistics_base: {
    new (...args: any[]): {
        fontStyle?: import("ag-charts-community").FontStyle | undefined;
        fontWeight?: import("ag-charts-community").FontWeight | undefined;
        fontSize: number;
        fontFamily: string;
        color?: string | undefined;
    };
} & {
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
declare class MeasurerStatistics extends MeasurerStatistics_base {
    divider: MeasurerStatisticsDivider;
}
declare const MeasurerDirectionProperties_base: {
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
declare class MeasurerDirectionProperties extends MeasurerDirectionProperties_base {
    statistics: MeasurerStatistics;
}
declare const MeasurerTypeProperties_base: {
    new (...args: any[]): {
        localeManager?: import("packages/ag-charts-community/dist/types/src/locale/localeManager").LocaleManager | undefined;
        setLocaleManager(localeManager: import("packages/ag-charts-community/dist/types/src/locale/localeManager").LocaleManager): void;
    };
} & {
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
} & typeof StartEndProperties;
export declare class MeasurerTypeProperties extends MeasurerTypeProperties_base {
    direction: 'both' | 'horizontal' | 'vertical';
    hasDateRange: boolean;
    hasPriceRange: boolean;
    statistics: MeasurerStatistics;
    getVolume: (from: Point['x'], to: Point['x']) => number | undefined;
    text: LineTextProperties;
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(colorPickerType: AnnotationOptionsColorPickerType): number | undefined;
    getLineDash(): PixelSize[] | undefined;
    getLineCap(): _ModuleSupport.ShapeLineCap | undefined;
}
declare const DateRangeProperties_base: {
    new (...args: any[]): {
        hasDateRange: boolean;
    };
} & typeof MeasurerTypeProperties;
export declare class DateRangeProperties extends DateRangeProperties_base {
    static is(this: void, value: unknown): value is DateRangeProperties;
    type: AnnotationType.DateRange;
    extendAbove?: boolean;
    extendBelow?: boolean;
    direction: "horizontal";
}
declare const PriceRangeProperties_base: {
    new (...args: any[]): {
        hasPriceRange: boolean;
    };
} & typeof MeasurerTypeProperties;
export declare class PriceRangeProperties extends PriceRangeProperties_base {
    static is(this: void, value: unknown): value is PriceRangeProperties;
    type: AnnotationType.PriceRange;
    extendLeft?: boolean;
    extendRight?: boolean;
    direction: "vertical";
}
declare const DatePriceRangeProperties_base: {
    new (...args: any[]): {
        hasDateRange: boolean;
    };
} & {
    new (...args: any[]): {
        hasPriceRange: boolean;
    };
} & typeof MeasurerTypeProperties;
export declare class DatePriceRangeProperties extends DatePriceRangeProperties_base {
    static is(this: void, value: unknown): value is DatePriceRangeProperties;
    type: AnnotationType.DatePriceRange;
    direction: "both";
}
declare const QuickDatePriceRangeProperties_base: {
    new (...args: any[]): {
        hasDateRange: boolean;
    };
} & {
    new (...args: any[]): {
        hasPriceRange: boolean;
    };
} & typeof MeasurerTypeProperties;
export declare class QuickDatePriceRangeProperties extends QuickDatePriceRangeProperties_base {
    static is(this: void, value: unknown): value is QuickDatePriceRangeProperties;
    type: AnnotationType.QuickDatePriceRange;
    up: MeasurerDirectionProperties;
    down: MeasurerDirectionProperties;
    direction: "both";
}
export {};

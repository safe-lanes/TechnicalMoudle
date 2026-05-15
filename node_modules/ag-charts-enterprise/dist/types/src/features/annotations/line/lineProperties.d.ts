import { type PixelSize, _ModuleSupport } from 'ag-charts-community';
import { LineTextProperties } from '../annotationProperties';
import { type AnnotationOptionsColorPickerType, AnnotationType } from '../annotationTypes';
import { StartEndProperties } from '../properties/startEndProperties';
declare const LineTypeProperties_base: {
    new (...args: any[]): {
        localeManager?: import("packages/ag-charts-community/dist/types/src/locale/localeManager").LocaleManager | undefined;
        setLocaleManager(localeManager: import("packages/ag-charts-community/dist/types/src/locale/localeManager").LocaleManager): void;
    };
} & {
    new (...args: any[]): {
        startCap?: "arrow" | undefined;
        endCap?: "arrow" | undefined;
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
} & typeof StartEndProperties;
export declare abstract class LineTypeProperties extends LineTypeProperties_base {
    text: LineTextProperties;
    getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    getDefaultOpacity(): number | undefined;
    getLineDash(): PixelSize[] | undefined;
    getLineCap(): _ModuleSupport.ShapeLineCap | undefined;
}
export declare class ArrowProperties extends LineTypeProperties {
    static is(this: void, value: unknown): value is ArrowProperties;
    type: AnnotationType.Arrow;
    endCap: "arrow";
}
export declare class LineProperties extends LineTypeProperties {
    static is(this: void, value: unknown): value is LineProperties;
    type: AnnotationType.Line;
}
export {};

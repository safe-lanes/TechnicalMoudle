import { _ModuleSupport } from 'ag-charts-community';
import type { AnnotationContext } from '../annotationTypes';
import type { MeasurerTypeProperties, QuickDatePriceRangeProperties } from './measurerProperties';
export interface Statistics {
    dateRange?: {
        bars: number;
        value: number;
    };
    priceRange?: {
        percentage: number;
        value: number;
    };
    volume?: number;
}
export declare class MeasurerStatisticsScene extends _ModuleSupport.Group {
    name: string;
    private readonly background;
    private readonly dateRangeBarsText;
    private readonly dateRangeDivider;
    private readonly dateRangeValueText;
    private readonly priceRangeValueText;
    private readonly priceRangeDivider;
    private readonly priceRangePercentageText;
    private readonly volumeText;
    private readonly volumeFormatter;
    protected verticalDirection?: 'up' | 'down';
    constructor();
    update(datum: MeasurerTypeProperties, stats: Statistics, anchor: _ModuleSupport.Vec2, coords: _ModuleSupport.Vec4, context: AnnotationContext, verticalDirection?: 'up' | 'down', localeManager?: _ModuleSupport.ModuleContext['localeManager']): void;
    private checkVisibility;
    private updateStatistics;
    private updateBackground;
    private reposition;
    protected getTextStyles(datum: MeasurerTypeProperties): {
        fill: string | undefined;
        fontFamily: string;
        fontSize: number;
        fontStyle: import("ag-charts-community").FontStyle | undefined;
        fontWeight: import("ag-charts-community").FontWeight | undefined;
        textBaseline: "top";
    };
    protected getDividerStyles(datum: MeasurerTypeProperties): {
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
    protected getBackgroundStyles(datum: MeasurerTypeProperties): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
        cornerRadius: number;
    };
    private formatDateRangeBars;
    private formatDateRangeValue;
    private formatPriceRangeValue;
    private formatPriceRangePercentage;
    private formatVolume;
}
export declare class QuickMeasurerStatisticsScene extends MeasurerStatisticsScene {
    private getDirectionStyles;
    getTextStyles(datum: QuickDatePriceRangeProperties): {
        fill: string | undefined;
        fontFamily: string;
        fontSize: number;
        fontStyle: import("ag-charts-community").FontStyle | undefined;
        fontWeight: import("ag-charts-community").FontWeight | undefined;
        textBaseline: "top";
    };
    getDividerStyles(datum: QuickDatePriceRangeProperties): {
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
    };
    getBackgroundStyles(datum: QuickDatePriceRangeProperties): {
        fill: string | undefined;
        stroke: string | undefined;
        strokeOpacity: number | undefined;
        strokeWidth: number | undefined;
        cornerRadius: number;
    };
}

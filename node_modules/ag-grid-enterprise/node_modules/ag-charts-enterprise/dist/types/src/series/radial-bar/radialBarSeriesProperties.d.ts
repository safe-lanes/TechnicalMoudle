import type { AgRadialBarSeriesOptions, AgRadialSeriesItemStylerParams, AgRadialSeriesLabelFormatterParams, AgRadialSeriesStyle, AgRadialSeriesTooltipRendererParams, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties;
export declare class RadialBarSeriesProperties<T extends AgRadialBarSeriesOptions> extends SeriesProperties<T> {
    angleKey: string;
    radiusKey: string;
    angleName?: string;
    radiusName?: string;
    fill: InternalAgColorType;
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    cornerRadius: number;
    itemStyler?: Styler<AgRadialSeriesItemStylerParams<unknown>, AgRadialSeriesStyle>;
    rotation: number;
    stackGroup?: string;
    normalizedTo?: number;
    readonly label: _ModuleSupport.Label<AgRadialSeriesLabelFormatterParams, any>;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgRadialSeriesTooltipRendererParams<any, unknown>, "context">>;
    getStyle(): Required<AgRadialSeriesStyle> & {
        opacity: number;
    };
}
export {};

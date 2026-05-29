import type { AgBaseRadialColumnSeriesOptions, AgRadialSeriesItemStylerParams, AgRadialSeriesLabelFormatterParams, AgRadialSeriesStyle, AgRadialSeriesTooltipRendererParams, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties;
export declare class RadialColumnSeriesBaseProperties<T extends AgBaseRadialColumnSeriesOptions> extends SeriesProperties<T> {
    angleKey: string;
    angleName?: string;
    radiusKey: string;
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

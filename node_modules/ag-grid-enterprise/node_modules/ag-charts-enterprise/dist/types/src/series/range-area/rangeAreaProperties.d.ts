import type { AgRangeAreaSeriesLabelFormatterParams, AgRangeAreaSeriesLabelPlacement, AgRangeAreaSeriesOptions, AgRangeAreaSeriesOptionsKeys, AgRangeAreaSeriesTooltipRendererParams, PixelSize } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
export interface RangeAreaMarkerDatum extends Omit<_ModuleSupport.CartesianSeriesNodeDatum, 'yKey' | 'yValue'> {
    readonly index: number;
    readonly yLowKey: string;
    readonly yHighKey: string;
    readonly yLowValue: number;
    readonly yHighValue: number;
    readonly point: Readonly<_ModuleSupport.SizedPoint>;
    readonly enabled: boolean;
}
declare const CartesianSeriesProperties: typeof _ModuleSupport.CartesianSeriesProperties, Label: typeof _ModuleSupport.Label;
declare class RangeAreaSeriesLabel extends Label<AgRangeAreaSeriesLabelFormatterParams> {
    placement: AgRangeAreaSeriesLabelPlacement;
    spacing: PixelSize;
}
export declare class RangeAreaProperties extends CartesianSeriesProperties<AgRangeAreaSeriesOptions> {
    xKey: string;
    yLowKey: string;
    yHighKey: string;
    xName?: string;
    yName?: string;
    yLowName?: string;
    yHighName?: string;
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
    interpolation: _ModuleSupport.InterpolationProperties;
    readonly shadow: _ModuleSupport.DropShadow;
    readonly marker: _ModuleSupport.SeriesMarker<AgRangeAreaSeriesOptionsKeys<any>>;
    readonly label: RangeAreaSeriesLabel;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgRangeAreaSeriesTooltipRendererParams<any, unknown>, "context">>;
    connectMissingData: boolean;
}
export {};

import type { AgRangeBarSeriesItemStylerParams, AgRangeBarSeriesLabelFormatterParams, AgRangeBarSeriesLabelPlacement, AgRangeBarSeriesOptions, AgRangeBarSeriesStyle, AgRangeBarSeriesTooltipRendererParams, PixelSize, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
declare const AbstractBarSeriesProperties: typeof _ModuleSupport.AbstractBarSeriesProperties, Label: typeof _ModuleSupport.Label;
declare class RangeBarSeriesLabel extends Label<AgRangeBarSeriesLabelFormatterParams> {
    placement: AgRangeBarSeriesLabelPlacement;
    spacing: PixelSize;
}
export declare class RangeBarProperties extends AbstractBarSeriesProperties<AgRangeBarSeriesOptions> {
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
    cornerRadius: number;
    itemStyler?: Styler<AgRangeBarSeriesItemStylerParams<unknown>, AgRangeBarSeriesStyle>;
    readonly shadow: _ModuleSupport.DropShadow;
    readonly label: RangeBarSeriesLabel;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgRangeBarSeriesTooltipRendererParams<unknown>, "context">>;
    getStyle(): Required<AgRangeBarSeriesStyle> & {
        opacity: number;
    };
}
export {};

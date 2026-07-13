import type { AgColorType, AgPyramidSeriesItemStylerParams, AgPyramidSeriesLabelFormatterParams, AgPyramidSeriesOptions, AgPyramidSeriesStyle, AgPyramidSeriesTooltipRendererParams, Direction, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties, Label: typeof _ModuleSupport.Label;
declare class PyramidSeriesLabel extends Label<AgPyramidSeriesLabelFormatterParams> {
}
declare class PyramidSeriesStageLabel extends Label<AgPyramidSeriesLabelFormatterParams> {
    spacing: number;
    placement?: string;
}
export declare class PyramidProperties extends SeriesProperties<AgPyramidSeriesOptions> {
    stageKey: string;
    valueKey: string;
    fills: AgColorType[];
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    fillOpacity: number;
    strokes: string[];
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    direction: Direction;
    reverse?: boolean;
    spacing: number;
    aspectRatio?: number;
    itemStyler?: Styler<AgPyramidSeriesItemStylerParams<unknown>, AgPyramidSeriesStyle>;
    readonly shadow: _ModuleSupport.DropShadow;
    readonly label: PyramidSeriesLabel;
    readonly stageLabel: PyramidSeriesStageLabel;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgPyramidSeriesTooltipRendererParams<unknown, unknown>, "context">>;
    getStyle(index?: number): Required<AgPyramidSeriesStyle> & {
        opacity: number;
    };
}
export {};

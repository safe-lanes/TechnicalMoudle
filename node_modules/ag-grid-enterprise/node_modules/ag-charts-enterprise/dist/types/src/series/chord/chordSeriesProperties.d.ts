import { type AgChordSeriesLabelFormatterParams, type AgChordSeriesLinkItemStylerParams, type AgChordSeriesLinkStyle, type AgChordSeriesNodeItemStylerParams, type AgChordSeriesNodeStyle, type AgChordSeriesOptions, type AgChordSeriesTooltipRendererParams, type Styler, _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties, SeriesProperties: typeof _ModuleSupport.SeriesProperties, Label: typeof _ModuleSupport.Label;
declare class ChordSeriesLabelProperties extends Label<AgChordSeriesLabelFormatterParams> {
    spacing: number;
    maxWidth: number;
}
declare class ChordSeriesLinkProperties extends BaseProperties<AgChordSeriesOptions> {
    fill: InternalAgColorType | undefined;
    fillOpacity: number;
    stroke: string | undefined;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    tension: number;
    itemStyler?: Styler<AgChordSeriesLinkItemStylerParams<unknown>, AgChordSeriesLinkStyle>;
    getStyle(fills: InternalAgColorType[], strokes: string[], index: number): Required<AgChordSeriesLinkStyle>;
}
declare class ChordSeriesNodeProperties extends BaseProperties<AgChordSeriesOptions> {
    spacing: number;
    width: number;
    fill: InternalAgColorType | undefined;
    fillOpacity: number;
    stroke: string | undefined;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    itemStyler?: Styler<AgChordSeriesNodeItemStylerParams<unknown>, AgChordSeriesNodeStyle>;
    getStyle(fills: InternalAgColorType[], strokes: string[], index: number): Required<AgChordSeriesNodeStyle>;
}
export declare class ChordSeriesProperties extends SeriesProperties<AgChordSeriesOptions> {
    fromKey: string;
    toKey: string;
    idKey: string;
    idName: string | undefined;
    labelKey: string | undefined;
    labelName: string | undefined;
    sizeKey: string | undefined;
    sizeName: string | undefined;
    nodes: any[] | undefined;
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    fills: InternalAgColorType[];
    strokes: string[];
    readonly label: ChordSeriesLabelProperties;
    readonly link: ChordSeriesLinkProperties;
    readonly node: ChordSeriesNodeProperties;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgChordSeriesTooltipRendererParams<any, unknown>, "context">>;
    constructor();
}
export {};

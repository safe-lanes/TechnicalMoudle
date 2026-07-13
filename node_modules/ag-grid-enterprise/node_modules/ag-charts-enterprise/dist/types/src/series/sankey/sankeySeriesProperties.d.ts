import { type AgSankeySeriesLabelFormatterParams, type AgSankeySeriesLinkItemStylerParams, type AgSankeySeriesLinkOptions, type AgSankeySeriesLinkStyle, type AgSankeySeriesNodeItemStylerParams, type AgSankeySeriesNodeOptions, type AgSankeySeriesNodeStyle, type AgSankeySeriesOptions, type AgSankeySeriesTooltipRendererParams, type Styler, _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
import type { FlowProportionLinkDatum, FlowProportionNodeDatum } from '../flow-proportion/flowProportionSeries';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties, SeriesProperties: typeof _ModuleSupport.SeriesProperties, Label: typeof _ModuleSupport.Label;
export interface SankeyNodeDatum extends FlowProportionNodeDatum<SankeyNodeDatum, SankeyLinkDatum> {
    size: number;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface SankeyLinkDatum extends FlowProportionLinkDatum<SankeyNodeDatum, SankeyLinkDatum> {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    height: number;
}
export type SankeyDatum = SankeyLinkDatum | SankeyNodeDatum;
export interface SankeyNodeLabelDatum {
    x: number;
    y: number;
    leading: boolean;
    text: string;
    size: number;
}
declare class SankeySeriesLabelProperties extends Label<AgSankeySeriesLabelFormatterParams> {
    spacing: number;
}
declare class SankeySeriesLinkProperties extends BaseProperties<AgSankeySeriesLinkOptions<any>> {
    fill: InternalAgColorType | undefined;
    fillOpacity: number;
    stroke: string | undefined;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    itemStyler?: Styler<AgSankeySeriesLinkItemStylerParams<unknown>, AgSankeySeriesLinkStyle>;
}
declare class SankeySeriesNodeProperties extends BaseProperties<AgSankeySeriesNodeOptions<any>> {
    spacing: number;
    width: number;
    alignment: 'left' | 'right' | 'center' | 'justify';
    fill: InternalAgColorType | undefined;
    fillOpacity: number;
    stroke: string | undefined;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    itemStyler?: Styler<AgSankeySeriesNodeItemStylerParams<unknown>, AgSankeySeriesNodeStyle>;
}
export declare class SankeySeriesProperties extends SeriesProperties<AgSankeySeriesOptions> {
    nodes: any[] | undefined;
    fromKey: string;
    toKey: string;
    idKey: string;
    idName: string | undefined;
    labelKey: string | undefined;
    labelName: string | undefined;
    sizeKey: string | undefined;
    sizeName: string | undefined;
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    defaultColorRange: string[][];
    defaultPatternFills: string[];
    fills: InternalAgColorType[];
    strokes: string[];
    readonly label: SankeySeriesLabelProperties;
    readonly link: SankeySeriesLinkProperties;
    readonly node: SankeySeriesNodeProperties;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgSankeySeriesTooltipRendererParams<any, unknown>, "context">>;
    constructor();
    getStyle(isLink: boolean, fills: InternalAgColorType[], strokes: string[], index: number): Required<AgSankeySeriesLinkStyle> | Required<AgSankeySeriesNodeStyle>;
}
export {};

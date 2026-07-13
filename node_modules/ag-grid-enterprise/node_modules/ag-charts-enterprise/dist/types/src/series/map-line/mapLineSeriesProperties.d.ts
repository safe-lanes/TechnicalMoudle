import type { AgMapLineSeriesItemStylerParams, AgMapLineSeriesLabelFormatterParams, AgMapLineSeriesOptions, AgMapLineSeriesStyle, AgMapLineSeriesTooltipRendererParams, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties;
export interface MapLineNodeLabelDatum extends _ModuleSupport.PointLabelDatum {
}
export interface MapLineNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly idValue: string;
    readonly labelValue: string | undefined;
    readonly colorValue: number | undefined;
    readonly sizeValue: number | undefined;
    readonly legendItemName: string | undefined;
    readonly projectedGeometry: _ModuleSupport.Geometry | undefined;
}
export declare class MapLineSeriesProperties extends SeriesProperties<AgMapLineSeriesOptions> {
    topology?: _ModuleSupport.FeatureCollection;
    title?: string;
    legendItemName?: string;
    idKey: string;
    topologyIdKey: string;
    idName?: string;
    labelKey?: string;
    labelName?: string;
    sizeKey?: string;
    sizeName?: string;
    colorKey?: string;
    colorName?: string;
    sizeDomain?: [number, number];
    colorRange: string[] | undefined;
    maxStrokeWidth?: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    itemStyler?: Styler<AgMapLineSeriesItemStylerParams<unknown>, AgMapLineSeriesStyle>;
    readonly label: _ModuleSupport.Label<AgMapLineSeriesLabelFormatterParams, any>;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgMapLineSeriesTooltipRendererParams<any>, "context">>;
}
export {};

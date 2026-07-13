import type { AgMapMarkerSeriesItemStylerParams, AgMapMarkerSeriesLabelFormatterParams, AgMapMarkerSeriesOptions, AgMapMarkerSeriesStyle, AgMapMarkerSeriesTooltipRendererParams, AgMarkerShape, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties, Label: typeof _ModuleSupport.Label;
export interface MapMarkerNodeLabelDatum extends _ModuleSupport.PointLabelDatum {
}
export interface MapMarkerNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly index: number;
    readonly idValue: string | undefined;
    readonly lonValue: number | undefined;
    readonly latValue: number | undefined;
    readonly labelValue: string | undefined;
    readonly colorValue: number | undefined;
    readonly sizeValue: number | undefined;
    readonly legendItemName: string | undefined;
    readonly point: Readonly<_ModuleSupport.SizedPoint>;
}
declare class MapMarkerSeriesLabel extends Label<AgMapMarkerSeriesLabelFormatterParams> {
    placement: _ModuleSupport.LabelPlacement;
}
export declare class MapMarkerSeriesProperties extends SeriesProperties<AgMapMarkerSeriesOptions> {
    topology: _ModuleSupport.FeatureCollection | undefined;
    title?: string;
    legendItemName?: string;
    idKey: string | undefined;
    topologyIdKey: string;
    idName: string | undefined;
    latitudeKey: string | undefined;
    latitudeName: string | undefined;
    longitudeKey: string | undefined;
    longitudeName: string | undefined;
    labelKey: string | undefined;
    labelName: string | undefined;
    sizeKey?: string;
    sizeName?: string;
    colorKey?: string;
    colorName?: string;
    colorRange: string[] | undefined;
    /** One of the predefined marker names, or a marker shape function (for user-defined markers). */
    shape: AgMarkerShape;
    size: number;
    maxSize: number | undefined;
    sizeDomain?: [number, number];
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
    itemStyler?: Styler<AgMapMarkerSeriesItemStylerParams<unknown>, AgMapMarkerSeriesStyle>;
    readonly label: MapMarkerSeriesLabel;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgMapMarkerSeriesTooltipRendererParams<any, unknown>, "context">>;
    getStyle(): Required<AgMapMarkerSeriesStyle> & {
        opacity: number;
    };
}
export {};

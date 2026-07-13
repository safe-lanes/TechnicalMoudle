import type { AgMapShapeSeriesItemStylerParams, AgMapShapeSeriesLabelFormatterParams, AgMapShapeSeriesOptions, AgMapShapeSeriesStyle, AgMapShapeSeriesTooltipRendererParams, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
import { AutoSizedSecondaryLabel } from '../util/autoSizedLabel';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties;
export interface MapShapeNodeLabelDatum {
    readonly x: number;
    readonly y: number;
    readonly text: string;
    readonly fontSize: number;
    readonly lineHeight: number;
}
export interface MapShapeNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly idValue: string;
    readonly colorValue: number | undefined;
    readonly labelValue: string | undefined;
    readonly legendItemName: string | undefined;
    readonly projectedGeometry: _ModuleSupport.Geometry | undefined;
}
export declare class MapShapeSeriesProperties extends SeriesProperties<AgMapShapeSeriesOptions> {
    topology?: _ModuleSupport.FeatureCollection;
    title?: string;
    legendItemName?: string;
    idKey: string;
    idName: string | undefined;
    topologyIdKey: string;
    labelKey: string | undefined;
    labelName: string | undefined;
    colorKey?: string;
    colorName?: string;
    colorRange: string[] | undefined;
    fill: InternalAgColorType;
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    padding: number;
    itemStyler?: Styler<AgMapShapeSeriesItemStylerParams<unknown>, AgMapShapeSeriesStyle>;
    readonly label: AutoSizedSecondaryLabel<AgMapShapeSeriesLabelFormatterParams>;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgMapShapeSeriesTooltipRendererParams<any, unknown>, "context">>;
    getStyle(): Required<AgMapShapeSeriesStyle> & {
        opacity: number;
    };
}
export {};

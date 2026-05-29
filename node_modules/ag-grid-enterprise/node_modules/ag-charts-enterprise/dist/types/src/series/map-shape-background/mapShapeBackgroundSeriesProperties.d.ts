import type { AgMapShapeBackgroundOptions } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties;
export interface MapShapeBackgroundNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly index: number;
    readonly projectedGeometry: _ModuleSupport.Geometry;
}
export declare class MapShapeBackgroundSeriesProperties extends SeriesProperties<AgMapShapeBackgroundOptions> {
    topology?: _ModuleSupport.FeatureCollection;
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
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<never, "context">>;
}
export {};

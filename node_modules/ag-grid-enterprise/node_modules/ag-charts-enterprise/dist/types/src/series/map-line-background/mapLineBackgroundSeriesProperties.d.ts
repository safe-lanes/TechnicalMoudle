import type { AgMapLineBackgroundOptions } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
declare const SeriesProperties: typeof _ModuleSupport.SeriesProperties;
export interface MapLineBackgroundNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly index: number;
    readonly projectedGeometry: _ModuleSupport.Geometry;
}
export declare class MapLineBackgroundSeriesProperties extends SeriesProperties<AgMapLineBackgroundOptions> {
    topology?: _ModuleSupport.FeatureCollection;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<never, "context">>;
}
export {};

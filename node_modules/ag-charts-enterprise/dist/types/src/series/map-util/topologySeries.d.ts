import { _ModuleSupport } from 'ag-charts-community';
interface TopologySeriesNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
}
interface TopologySeriesNodeDataContext<TDatum extends TopologySeriesNodeDatum = TopologySeriesNodeDatum, TLabel extends object = object> extends _ModuleSupport.DataModelSeriesNodeDataContext<TDatum, TLabel> {
}
declare abstract class TopologySeriesProperties<T extends object> extends _ModuleSupport.SeriesProperties<T> {
}
export declare abstract class TopologySeries<TDatum extends TopologySeriesNodeDatum, TOpts extends object, TProps extends TopologySeriesProperties<TOpts>, TLabel extends object, TContext extends TopologySeriesNodeDataContext<TDatum, TLabel> = TopologySeriesNodeDataContext<TDatum, TLabel>> extends _ModuleSupport.DataModelSeries<TDatum, TOpts, TProps, TLabel, TContext> {
    addChartEventListeners(): void;
    getSeriesDomain(): number[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, _visibleRange: [any, any]): [number, number];
}
export {};

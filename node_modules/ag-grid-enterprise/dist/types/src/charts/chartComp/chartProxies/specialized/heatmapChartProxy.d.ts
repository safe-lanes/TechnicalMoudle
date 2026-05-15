import type { AgCartesianChartOptions, AgChartThemeOverrides, AgHeatmapSeriesOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { ChartProxy } from '../chartProxy';
export declare class HeatmapChartProxy extends ChartProxy<AgCartesianChartOptions, 'heatmap'> {
    protected getUpdateOptions(params: UpdateParams, commonChartOptions: AgCartesianChartOptions): AgCartesianChartOptions;
    protected getSeries(params: UpdateParams, xSeriesKey: string, xValueKey: string, yKey: string): AgHeatmapSeriesOptions[];
    protected getData(params: UpdateParams, xSeriesKey: string, xValueKey: string, yKey: string): any[];
    protected getSeriesChartThemeDefaults(): AgChartThemeOverrides['heatmap'];
}

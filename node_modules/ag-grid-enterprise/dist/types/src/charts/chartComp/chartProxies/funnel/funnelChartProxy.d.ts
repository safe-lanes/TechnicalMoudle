import type { AgChartThemeOverrides, AgConeFunnelSeriesOptions, AgFunnelSeriesOptions, AgPyramidSeriesOptions, AgStandaloneChartOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { ChartProxy } from '../chartProxy';
type FunnelTypes = AgPyramidSeriesOptions | AgFunnelSeriesOptions | AgConeFunnelSeriesOptions;
type FunnelChartTypes = FunnelTypes['type'];
export declare class FunnelChartProxy extends ChartProxy<AgStandaloneChartOptions, FunnelChartTypes> {
    protected getUpdateOptions(params: UpdateParams, commonChartOptions: AgStandaloneChartOptions): AgStandaloneChartOptions;
    private transformFunnelCategories;
    protected getSeriesChartThemeDefaults(): AgChartThemeOverrides[FunnelChartTypes];
    private getSeries;
}
export {};

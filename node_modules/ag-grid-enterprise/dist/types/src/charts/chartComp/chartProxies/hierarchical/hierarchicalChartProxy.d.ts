import type { AgChartThemeOverrides, AgHierarchyChartOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { ChartProxy } from '../chartProxy';
export declare class HierarchicalChartProxy<TSeries extends 'sunburst' | 'treemap'> extends ChartProxy<AgHierarchyChartOptions, TSeries> {
    protected getUpdateOptions(params: UpdateParams, commonChartOptions: AgHierarchyChartOptions): AgHierarchyChartOptions;
    protected getSeriesChartThemeDefaults(): AgChartThemeOverrides['treemap' | 'sunburst'];
    private getSeries;
    private getData;
}

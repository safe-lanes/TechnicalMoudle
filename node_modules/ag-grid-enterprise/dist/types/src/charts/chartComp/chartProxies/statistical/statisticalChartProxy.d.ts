import type { AgCartesianAxisOptions, AgCartesianChartOptions } from 'ag-charts-types';
import { CartesianChartProxy } from '../cartesian/cartesianChartProxy';
import type { UpdateParams } from '../chartProxy';
export declare abstract class StatisticalChartProxy<TSeries extends 'box-plot' | 'range-area' | 'range-bar'> extends CartesianChartProxy<TSeries> {
    getAxes(params: UpdateParams, commonChartOptions: AgCartesianChartOptions): AgCartesianAxisOptions[];
    protected computeSeriesStatistics(params: UpdateParams, computeStatsFn: (values: number[]) => any): any[];
    protected groupDataByCategory(categoryKey: string, data: any[]): Map<any, any[]>;
}

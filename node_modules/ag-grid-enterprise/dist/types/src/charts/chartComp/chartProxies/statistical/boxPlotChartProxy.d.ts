import type { AgBoxPlotSeriesOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { StatisticalChartProxy } from './statisticalChartProxy';
export declare class BoxPlotChartProxy extends StatisticalChartProxy<'box-plot'> {
    getSeries(params: UpdateParams): AgBoxPlotSeriesOptions<any>[];
    protected getData(params: UpdateParams): any[];
    private quantile;
}

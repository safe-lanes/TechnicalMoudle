import type { AgCartesianAxisOptions, AgCartesianChartOptions, AgWaterfallSeriesOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { CartesianChartProxy } from './cartesianChartProxy';
export declare class WaterfallChartProxy extends CartesianChartProxy<'waterfall'> {
    protected getAxes(params: UpdateParams, commonChartOptions: AgCartesianChartOptions): AgCartesianAxisOptions[];
    protected getSeries(params: UpdateParams): AgWaterfallSeriesOptions[];
}

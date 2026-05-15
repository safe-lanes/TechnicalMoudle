import type { AgAreaSeriesOptions, AgCartesianAxisOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { CartesianChartProxy } from './cartesianChartProxy';
export declare class AreaChartProxy extends CartesianChartProxy<'area'> {
    protected getAxes(params: UpdateParams): AgCartesianAxisOptions[];
    protected getSeries(params: UpdateParams): (AgAreaSeriesOptions<any, unknown> | import("ag-charts-types").AgLineSeriesOptions<any, unknown>)[];
    private isNormalised;
}

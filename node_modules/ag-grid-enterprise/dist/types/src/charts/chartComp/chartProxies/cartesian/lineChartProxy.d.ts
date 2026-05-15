import type { AgCartesianAxisOptions, AgLineSeriesOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { CartesianChartProxy } from './cartesianChartProxy';
export declare class LineChartProxy extends CartesianChartProxy<'line'> {
    protected getAxes(params: UpdateParams): AgCartesianAxisOptions[];
    protected getSeries(params: UpdateParams): (import("ag-charts-types").AgAreaSeriesOptions<any, unknown> | AgLineSeriesOptions<any, unknown>)[];
    private isNormalised;
}

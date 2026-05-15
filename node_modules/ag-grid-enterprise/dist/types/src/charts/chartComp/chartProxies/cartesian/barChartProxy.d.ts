import type { AgBarSeriesOptions, AgCartesianAxisOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { CartesianChartProxy } from './cartesianChartProxy';
export declare class BarChartProxy extends CartesianChartProxy<'bar'> {
    protected getAxes(params: UpdateParams): AgCartesianAxisOptions[];
    protected getSeries(params: UpdateParams): AgBarSeriesOptions[];
    private extractCrossFilterSeries;
    private isNormalised;
    protected isHorizontal(): boolean;
}

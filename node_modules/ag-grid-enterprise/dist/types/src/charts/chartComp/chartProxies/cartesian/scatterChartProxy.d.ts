import type { AgBubbleSeriesOptions, AgCartesianAxisOptions, AgScatterSeriesOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { CartesianChartProxy } from './cartesianChartProxy';
export declare class ScatterChartProxy extends CartesianChartProxy<'scatter' | 'bubble'> {
    protected getAxes(_params: UpdateParams): AgCartesianAxisOptions[];
    protected getSeries(params: UpdateParams): (AgScatterSeriesOptions | AgBubbleSeriesOptions)[];
    private extractCrossFilterSeries;
    private getSeriesDefinitions;
}

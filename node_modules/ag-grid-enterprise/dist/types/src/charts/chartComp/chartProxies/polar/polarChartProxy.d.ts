import type { AgPolarAxisOptions, AgPolarChartOptions, AgPolarSeriesOptions } from 'ag-charts-types';
import type { SeriesGroupType } from 'ag-grid-community';
import type { UpdateParams } from '../chartProxy';
import { ChartProxy } from '../chartProxy';
export declare class PolarChartProxy extends ChartProxy<AgPolarChartOptions, 'radar-line' | 'radar-area' | 'nightingale' | 'radial-column' | 'radial-bar'> {
    getAxes(_: UpdateParams): AgPolarAxisOptions[];
    getSeries(params: UpdateParams): AgPolarSeriesOptions[];
    getSeriesGroupType(): SeriesGroupType | undefined;
    protected getUpdateOptions(params: UpdateParams, commonChartOptions: AgPolarChartOptions): AgPolarChartOptions;
    private getData;
    private getSeriesGroupTypeOptions;
}

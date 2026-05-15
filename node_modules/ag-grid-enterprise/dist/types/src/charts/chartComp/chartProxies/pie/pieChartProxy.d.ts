import type { AgPolarChartOptions } from 'ag-charts-types';
import type { UpdateParams } from '../chartProxy';
import { ChartProxy } from '../chartProxy';
export declare class PieChartProxy extends ChartProxy<AgPolarChartOptions, 'pie' | 'donut'> {
    protected getUpdateOptions(params: UpdateParams, commonChartOptions: AgPolarChartOptions): AgPolarChartOptions;
    private getSeries;
    private getCrossFilterData;
    private extractCrossFilterSeries;
    private getFields;
}

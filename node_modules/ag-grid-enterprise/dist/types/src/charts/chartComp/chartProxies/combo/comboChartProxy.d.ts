import type { AgCartesianAxisOptions } from 'ag-charts-types';
import { CartesianChartProxy } from '../cartesian/cartesianChartProxy';
import type { UpdateParams } from '../chartProxy';
export declare class ComboChartProxy extends CartesianChartProxy<'line' | 'bar' | 'area'> {
    getAxes(params: UpdateParams): AgCartesianAxisOptions[];
    getSeries(params: UpdateParams): any;
    private getYKeys;
}

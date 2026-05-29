import { _ModuleSupport } from 'ag-charts-community';
export interface RangeBarSeriesDataAggregationFilter {
    indexData: Int32Array;
    maxRange: number;
}
export declare function aggregateRangeBarData(scale: _ModuleSupport.ScaleType, xValues: any[], highValues: any[], lowValues: any[], domain: number[]): RangeBarSeriesDataAggregationFilter[] | undefined;

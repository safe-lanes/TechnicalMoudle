import { _ModuleSupport } from 'ag-charts-community';
export interface RangeAreaSeriesDataAggregationFilter {
    maxRange: number;
    topIndices: number[];
    bottomIndices: number[];
}
export declare function aggregateRangeAreaData(scale: _ModuleSupport.ScaleType, xValues: any[], highValues: any[], lowValues: any[], domain: number[]): RangeAreaSeriesDataAggregationFilter[] | undefined;
